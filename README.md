# Smart Storage

A private, search-first component inventory for a workshop or parts cabinet. It runs on your computer, stores records and photos locally, and is reachable from phones or other computers on the same trusted network.

## Windows setup

1. Install Node.js 22 or newer.
2. Open PowerShell in this folder and run `npm install`.
3. Initialize the database with `npm run db:init`.
4. Optional: add sample data with `npm run db:seed`.
5. Start development with `npm run dev`, or run `npm run build` followed by `npm start` for normal use.
6. Open `http://localhost:3000` on this computer. From another device on the same network, use the Network address shown by the start command. Windows Firewall may ask you to allow private-network access.

The SQLite database and component photos are kept in `data/`, outside the application build. Set `SMART_STORAGE_DATA_DIR` in `.env.local` to use another folder.

## Backups and CSV files

The Data screen downloads a ZIP containing `components.csv`, `locations.csv`, `stock.csv`, and an `images/` folder. Import first validates the whole file and shows row-level issues; changes are written only after confirmation.

## Checks

- `npm test` — database rules and inventory workflow
- `npm run lint` — code quality checks
- `npm run build` — production build
