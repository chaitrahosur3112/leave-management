1️⃣ Clone the Repository
git clone https://github.com/your-username/leave-management.git
cd leave-management
2️⃣ Setup Backend
cd backend
npm install
3️⃣ Create .env file (inside backend)

Create a file named .env and add:

MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
PORT=5000
4️⃣ Run Backend
npm start

Server will run on:

http://localhost:5000
5️⃣ Setup Frontend
cd ../frontend
npm install
npm start