import express from 'express';
import cors from 'cors';
import path from 'path';

const app = express();

const corsOptions = {
  origin: '*',
};

app.use(cors(corsOptions));

// Serve static files from the "public" directory
const publicPath = path.join(path.resolve(), '');
app.use(express.static(publicPath));

// Start the server
app.listen(5555, () => {
  console.log('Server is running on port 4040');
});