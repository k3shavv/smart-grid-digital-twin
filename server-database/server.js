const express = require('express');
const cors = require('cors');
const Redis = require('ioredis');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Redis setup
const redisClient = new Redis();

redisClient.on('connect', () => {
    console.log('Connected to Redis cache successfully');
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

// Health check
app.get('/api/grid/status', (req, res) => {
    res.json({
        status: 'online',
        service: 'Grid Database Layer',
        timestamp: new Date().toISOString()
    });
});

// 1. Fetch grid topology (Redis Cached)
app.get('/api/grid/topology', async (req, res) => {
    try {
        const cachedGrid = await redisClient.get('grid:topology');
        if (cachedGrid) {
            return res.json({
                source: 'redis-cache',
                data: JSON.parse(cachedGrid)
            });
        }

        db.query('SELECT * FROM substations', (err, substations) => {
            if (err) return res.status(500).json({ error: err.message });

            db.query('SELECT * FROM power_lines', async (err, lines) => {
                if (err) return res.status(500).json({ error: err.message });

                const gridData = { substations, lines };
                await redisClient.set('grid:topology', JSON.stringify(gridData), 'EX', 15);

                return res.json({
                    source: 'mysql-database',
                    data: gridData
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Simulate Node Failure ("Chaos Button")
app.post('/api/grid/substation/:id/fail', (req, res) => {
    const substationId = req.params.id;
    const query = 'UPDATE substations SET status = "OFFLINE", current_load_kw = 0 WHERE id = ?';

    db.query(query, [substationId], async (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Substation not found' });
        }

        // Cache Invalidation: Delete old cache so the UI sees the failure immediately
        await redisClient.del('grid:topology');

        res.json({
            message: `Substation ${substationId} marked OFFLINE`,
            affectedSubstationId: substationId
        });
    });
});

// 3. Reset Grid to Normal State
app.post('/api/grid/reset', (req, res) => {
    const query = 'UPDATE substations SET status = "ONLINE", current_load_kw = 400.00';

    db.query(query, async (err) => {
        if (err) return res.status(500).json({ error: err.message });

        // Cache Invalidation
        await redisClient.del('grid:topology');

        res.json({ message: 'Grid reset to default operational state' });
    });
});

// 4. Batch update substation loads after rerouting calculation
app.post('/api/grid/reroute', (req, res) => {
    const { updates } = req.body; 
    // Expects: { updates: [ { id: 1, current_load_kw: 600 }, { id: 3, current_load_kw: 550 } ] }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'Invalid payload. Array of updates required.' });
    }

    // Build batch update query
    const cases = updates.map(u => `WHEN id = ${db.escape(u.id)} THEN ${db.escape(u.current_load_kw)}`).join(' ');
    const ids = updates.map(u => db.escape(u.id)).join(', ');
    const sql = `UPDATE substations SET current_load_kw = CASE ${cases} END WHERE id IN (${ids})`;

    db.query(sql, async (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        // Invalidate cache so users immediately fetch the freshly rerouted loads
        await redisClient.del('grid:topology');

        res.json({
            message: 'Grid load redistribution applied successfully',
            updatedNodes: result.affectedRows
        });
    });
});

// 5. Fetch historical load trends for a specific substation (for charts)
app.get('/api/grid/history/:id', (req, res) => {
    const substationId = req.params.id;
    const sql = `
        SELECT recorded_load_kw, recorded_at 
        FROM load_logs 
        WHERE substation_id = ? 
        ORDER BY recorded_at ASC 
        LIMIT 50
    `;

    db.query(sql, [substationId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            substation_id: parseInt(substationId),
            history: results
        });
    });
});

// 6. Record a new load snapshot into history
app.post('/api/grid/history/:id/log', (req, res) => {
    const substationId = req.params.id;
    const { load_kw } = req.body;

    if (load_kw === undefined) {
        return res.status(400).json({ error: 'load_kw is required' });
    }

    const sql = 'INSERT INTO load_logs (substation_id, recorded_load_kw) VALUES (?, ?)';
    db.query(sql, [substationId, load_kw], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({
            message: 'Load snapshot logged successfully',
            logId: result.insertId
        });
    });
});

// 7. Check for overloaded lines and trip circuit breakers automatically
app.post('/api/grid/lines/check-overload', (req, res) => {
    // Finds any line where current flow strictly exceeds maximum safe capacity
    const findOverloadsSql = `
        SELECT id, source_substation_id, target_substation_id, max_capacity_kw, current_flow_kw 
        FROM power_lines 
        WHERE current_flow_kw > max_capacity_kw AND status = 'ACTIVE'
    `;

    db.query(findOverloadsSql, (err, overloadedLines) => {
        if (err) return res.status(500).json({ error: err.message });

        if (overloadedLines.length === 0) {
            return res.json({
                message: 'All transmission lines operating within safe capacity limits.',
                trippedLines: []
            });
        }

        const trippedIds = overloadedLines.map(line => line.id);
        const tripSql = `
            UPDATE power_lines 
            SET status = 'TRIPPED', current_flow_kw = 0 
            WHERE id IN (?)
        `;

        db.query(tripSql, [trippedIds], async (updateErr) => {
            if (updateErr) return res.status(500).json({ error: updateErr.message });

            // Clear cache so the frontend immediately turns the lines red/dashed
            await redisClient.del('grid:topology');

            res.json({
                message: `Alert: ${trippedIds.length} line(s) exceeded capacity and tripped!`,
                trippedLines: overloadedLines
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});