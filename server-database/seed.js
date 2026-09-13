const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('./database');

const csvFilePath = path.join(__dirname, 'substations.csv');
const substations = [];

console.log('Reading substations.csv...');

fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
        substations.push([
            row.name,
            parseFloat(row.latitude),
            parseFloat(row.longitude),
            parseFloat(row.capacity_kw),
            parseFloat(row.current_load_kw || 0.0),
            row.status || 'ONLINE'
        ]);
    })
    .on('end', () => {
        console.log(`Parsed ${substations.length} substations. Inserting into MySQL...`);

        // Wipe old test records and reset auto-increment
        db.query('DELETE FROM power_lines', () => {
            db.query('DELETE FROM substations', () => {
                db.query('ALTER TABLE substations AUTO_INCREMENT = 1', () => {
                    const sql = `
                        INSERT INTO substations 
                        (name, latitude, longitude, capacity_kw, current_load_kw, status) 
                        VALUES ?
                    `;

                    db.query(sql, [substations], (err, result) => {
                        if (err) {
                            console.error('Error seeding database:', err.message);
                        } else {
                            console.log(`Successfully seeded ${result.affectedRows} substations!`);
                        }
                        process.exit();
                    });
                });
            });
        });
    });