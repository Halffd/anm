import express from 'express';
import cors from 'cors';
import path from 'path';

const app = express();

// Enable CORS for all routes
app.use(cors());

// Serve static files from the "public" directory
const publicPath = path.join(path.resolve(), '');
app.use(express.static(publicPath));

// Start the server
app.listen(4040, () => {
  console.log('Server is running on port 4040');
});