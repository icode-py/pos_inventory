# HOLO POS — Point-of-Sale & Inventory Management System

A full-stack POS and inventory platform built for Nigerian supermarkets and retail stores. Each client gets a dedicated deployment — their own server, their own database, their own URL. No shared data.

---

## Features

| Module | What it does |
|---|---|
| **POS Terminal** | Fast barcode/manual sales, offline mode with automatic sync, bulk pricing |
| **Inventory** | Product catalogue, categories, stock levels, bulk Excel upload |
| **Restocking** | Restock history with staff attribution |
| **Customer Loyalty** | Loyalty points, purchase history, tiered rewards (Bronze / Silver / Gold) |
| **Staff & Access Control** | Cashier / Manager / Admin roles, per-action audit log |
| **Sales Reports** | Daily trends, cashier performance, product analytics, margin analytics |
| **Low-Stock Alerts** | Automated notifications when stock falls below threshold |
| **Settings** | Store profile, receipt customisation, WhatsApp notification toggle |

---

## Tech Stack

**Backend**
- Python 3.13 / Django 5.2 / Django REST Framework 3.16
- PostgreSQL (per-client dedicated database)
- Simple JWT for authentication
- django-import-export for bulk Excel upload
- Hosted on Render

**Frontend**
- React 19 + Vite
- Material UI (MUI) v7
- Chart.js / react-chartjs-2
- Axios
- Hosted on Render (static site)

---

## Project Structure

```
pos_inventory/
├── core/                   # Django app — models, views, serializers, URLs
│   ├── models.py           # Staff, Product, Category, Customer, Sale, AuditLog, ...
│   ├── views.py            # All API endpoints
│   ├── serializers.py
│   ├── urls.py
│   └── admin.py
├── pos_inventory/          # Django project settings
│   ├── settings.py
│   └── urls.py
├── pos-frontend/           # React app
│   └── src/
│       ├── pages/          # One file per page (SalesPage, Products, Customers, ...)
│       ├── components/     # Shared components (Sidebar, Navbar, ...)
│       └── utils/          # axiosInstance, auth helpers
├── requirements.txt
├── Procfile                # Render deployment
└── manage.py
```

---

## Local Development Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL (or use SQLite for local dev)

### Backend

```bash
# Clone the repo
git clone <repo-url>
cd pos_inventory

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables (create a .env file)
cp .env.example .env
# Edit .env with your database credentials and secret key

# Run migrations
python manage.py migrate

# Create a superuser / first admin account
python manage.py createsuperuser

# Start the development server
python manage.py runserver
```

### Frontend

```bash
cd pos-frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to the Django backend on `http://localhost:8000`.

---

## Environment Variables

Create a `.env` file in the project root with the following keys:

```env
SECRET_KEY=your-django-secret-key
DEBUG=True

DATABASE_URL=postgres://user:password@localhost:5432/holo_pos

# JWT
JWT_SECRET_KEY=your-jwt-secret

# CORS — frontend origin
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Optional: WhatsApp notification webhook
WHATSAPP_API_URL=
WHATSAPP_API_TOKEN=
```

---

## API Overview

All endpoints are prefixed with `/api/`.

| Endpoint | Methods | Description |
|---|---|---|
| `/api/token/` | POST | Obtain JWT token pair |
| `/api/token/refresh/` | POST | Refresh access token |
| `/api/products/` | GET, POST | Product list and create |
| `/api/products/<id>/` | GET, PUT, PATCH, DELETE | Product detail |
| `/api/categories/` | GET, POST | Category list and create |
| `/api/customers/` | GET, POST | Customer list and create |
| `/api/customers/<id>/` | GET, PUT, PATCH | Customer detail |
| `/api/sales/` | GET, POST | Sale list and create |
| `/api/restock/` | GET, POST | Restock history |
| `/api/staff/` | GET | Staff list |
| `/api/staff/<id>/reset-password/` | POST | Reset staff password |
| `/api/staff/<id>/delete/` | DELETE | Delete staff account |
| `/api/audit-log/` | GET | Audit log entries |
| `/api/margin-analytics/` | GET | Margin and profitability data |
| `/api/store-settings/` | GET, PUT | Store configuration |

---

## Deployment (Render)

Each client is deployed as a **separate Render service** with its own environment variables and PostgreSQL database.

**Backend web service**
- Environment: Python 3
- Build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
- Start command: `gunicorn pos_inventory.wsgi:application`

**Frontend static site**
- Build command: `cd pos-frontend && npm install && npm run build`
- Publish directory: `pos-frontend/dist`

**Key environment variables to set per client on Render:**
```
SECRET_KEY
DATABASE_URL          # auto-provided by Render PostgreSQL
ALLOWED_HOSTS
CORS_ALLOWED_ORIGINS
```

---

## Roles & Permissions

| Permission | Cashier | Manager | Admin |
|---|---|---|---|
| Make sales | ✔ | ✔ | ✔ |
| View products | ✔ | ✔ | ✔ |
| Add / edit products | ✘ | ✔ | ✔ |
| Restock products | ✘ | ✔ | ✔ |
| View sales reports | ✘ | ✔ | ✔ |
| Manage customers | ✘ | ✔ | ✔ |
| Manage staff | ✘ | ✔ | ✔ |
| Delete staff accounts | ✘ | ✘ | ✔ |
| View audit log | ✘ | ✔ | ✔ |
| Store settings | ✘ | ✘ | ✔ |

---

## Offline Mode

The POS terminal supports full offline operation. When internet is unavailable:

1. Products are served from a local cache (updated on last successful sync)
2. Sales are stored in `localStorage` with a unique local ID
3. When connection is restored, pending sales sync automatically to the server
4. The cashier sees a live online/offline status indicator and a manual sync button

---

## License

Proprietary. All rights reserved. This software is provided to clients under a commercial licence agreement. Unauthorised copying, distribution, or modification is prohibited.

---

*Built by [Your Name / Company] · Contact: joanokereke7@gmail.com*
