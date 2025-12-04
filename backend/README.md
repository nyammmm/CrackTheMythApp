# Backend for CrackTheMythApp

This simple Express backend supports:
- Signup / Login via email+password (bcrypt + JWT)
- Serving small sample quizzes and books
- Getting/setting user achievements (protected by JWT)

Run locally
```powershell
cd backend
copy .env.example .env
# edit .env to set MONGO_URI and JWT_SECRET
npm install
npm start
```

Deploy
- Any Node host (Heroku, Railway, Fly, VPS) will work. Ensure `MONGO_URI` and `JWT_SECRET` are set as environment variables.
- The client (mobile app) must point to the deployed backend URL. Update the server URL in the app's Auth screen or configure it at build-time.

Security
- This is meant as a development backend. Add input validation, rate-limiting, secure CORS policies, and HTTPS for production.
