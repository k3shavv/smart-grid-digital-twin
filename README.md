# Smart Grid Digital Twin

This repository holds the microservices architecture for our Smart Grid Digital Twin project. We are using a **Monorepo** structure. 

## 📂 Repository Structure Rules

Every team member must keep their service isolated inside their respective subfolder at the root level. **Do not commit files directly to the root directory.**

```text
smart-grid-digital-twin/
│
├── frontend-ui/            # Nayanaa: React UI codebase
├── server-database/        # Keshav: Express API + MySQL + Redis Cache layer
├── server-queue/           # Siddhant: BullMQ + Redis background worker pipeline
├── server-optimization/    # Lavanya: Python engine executing graph routing mathematics
└── README.md

How to Contribute

    Pull the latest changes from main before starting work: git pull origin main

    Navigate into your specific directory to install or run code.

    Keep the root clean: Keep the global .gitignore at the root, but handle your own package.json or local environments inside your respective service folder.


