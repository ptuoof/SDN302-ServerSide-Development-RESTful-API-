const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const createError = require('http-errors');
require('dotenv').config();

const connectDb = require('./config/db');
const apiRoutes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Health check / Welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to CookFlow RESTful API Server - SDN302 (FPT University)',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      categories: '/api/categories',
      recipes: '/api/recipes',
      favorites: '/api/favorites',
      shopping: '/api/shopping',
      pantry: '/api/pantry',
      upload: '/api/upload'
    }
  });
});

// API Routes
app.use('/api', apiRoutes);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError.NotFound(`Resource not found at: ${req.originalUrl}`));
});

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 9999;
const HOST = process.env.HOSTNAME || '0.0.0.0';

// Start Server
app.listen(PORT, HOST, async () => {
  console.log(`\n=================================================`);
  console.log(`🚀 CookFlow API Server running at: http://${HOST}:${PORT}`);
  console.log(`📖 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=================================================\n`);
  await connectDb();
});

module.exports = app;
