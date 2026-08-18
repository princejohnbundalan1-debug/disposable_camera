# 🚀 Free Deployment Guide: Digital Disposable Camera

This guide provides step-by-step instructions to deploy both the **Database** and the **Web Application** completely for **FREE** with 100% functionality (QR codes, live camera, photo/video uploads, guestbook, organizer dashboard, and ZIP downloads).

---

## 🌟 Recommended Free Setup Summary

| Component | Recommended Free Provider | Free Tier Allowance | Time to Set Up |
| :--- | :--- | :--- | :--- |
| **Database** | [TiDB Cloud Serverless](https://tidbcloud.com) or [Aiven](https://aiven.io) | 25 GB MySQL (Free Forever) | ~2 minutes |
| **Web Hosting (Option A - Easiest)** | [Render.com](https://render.com) | Free Web Service (Node.js) | ~2 minutes |
| **Web Hosting (Option B - Serverless)** | [Vercel](https://vercel.com) | Free Hobby Plan (Serverless) | ~2 minutes |

---

## Step 1: Create a Free Cloud Database (MySQL)

Our application is built with automatic table migrations. Once you provide the connection details, all tables (`users`, `events`, `media`, `messages`) will be created automatically!

### Option A: TiDB Cloud Serverless (Recommended - 25GB Free MySQL)
1. Go to **[https://tidbcloud.com](https://tidbcloud.com)** and sign up with GitHub or Google (no credit card required).
2. Click **Create Cluster** -> Select **Serverless (Free)**.
3. Once created, click **Connect**:
   - Choose **Node.js** or **Standard Connection**.
   - Copy the connection details or connection string (`DATABASE_URL` or Host, Port, User, Password).
   - Set the password and save it securely.

### Option B: Aiven Free MySQL
1. Go to **[https://aiven.io](https://aiven.io)** and create a free account.
2. Create a new **MySQL** service on the free plan.
3. Copy the **Service URI** or Host, Port, User, Password, and SSL settings.

---

## Step 2: Deploy to Free Web Hosting

### 🎯 Option A: Deploy to Render.com (Recommended for Full Express Support)

Render natively runs full Node.js Express servers and handles file uploads smoothly:

1. Push your project code to a **GitHub** repository.
2. Go to **[https://render.com](https://render.com)** and sign in with GitHub.
3. Click **New +** -> **Web Service**.
4. Select your GitHub repository.
5. Configure the service settings:
   - **Name**: `wedding-disposable-camera`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
6. Scroll to **Environment Variables** and add:
   ```env
   NODE_ENV=production
   SESSION_SECRET=your_long_random_secret_string_here_12345
   APP_NAME="Wedding Moments"
   APP_URL=https://your-service-name.onrender.com

   # Database Settings (From Step 1)
   DATABASE_URL=mysql://<user>:<password>@<host>:<port>/<dbname>?ssl={"rejectUnauthorized":true}
   # OR discrete variables:
   # DB_HOST=your-cloud-db-host
   # DB_PORT=4000
   # DB_USER=your-username
   # DB_PASSWORD=your-password
   # DB_NAME=test
   # DB_SSL=true
   ```
7. Click **Create Web Service**.
8. Render will build and deploy your app in about 1-2 minutes!

---

### ⚡ Option B: Deploy to Vercel

The project is already pre-configured with `vercel.json` and `api/index.js` for serverless deployment:

1. Push your project to **GitHub**.
2. Go to **[https://vercel.com](https://vercel.com)** and log in with GitHub.
3. Click **Add New...** -> **Project** -> Select your repository.
4. In the **Environment Variables** section, add:
   ```env
   NODE_ENV=production
   SESSION_SECRET=your_long_random_secret_string_here_12345
   APP_NAME="Wedding Moments"
   APP_URL=https://your-project.vercel.app

   # Database Settings (From Step 1)
   DATABASE_URL=mysql://<user>:<password>@<host>:<port>/<dbname>?ssl={"rejectUnauthorized":true}
   # OR:
   # DB_HOST=your-cloud-db-host
   # DB_PORT=4000
   # DB_USER=your-username
   # DB_PASSWORD=your-password
   # DB_NAME=test
   # DB_SSL=true
   ```
5. Click **Deploy**.
6. Vercel will build and assign you a live `https://your-project.vercel.app` URL!

---

## Step 3: Verify Your Live Deployment

1. Visit your live URL (e.g. `https://your-service.onrender.com` or `https://your-project.vercel.app`).
2. Click **Create Your Wedding Event 💍** to register your organizer account.
3. Create your first wedding event (e.g., "Hannah & Juan's Wedding").
4. View the generated **QR Code** and print template.
5. Scan or open the guest link on your phone:
   - Take photos or record videos using the mobile retro viewfinder.
   - Upload photos from your camera roll.
   - Post a guestbook message.
6. Open the live album and organizer dashboard to view and download the wedding media collection as a ZIP!
