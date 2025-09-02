const express = require('express');
const { createClient } = require('redis');

const app = express();
const port = process.env.PORT || 3000;

// The REDIS_URL environment variable is automatically provided by Railway
// when you provision a Redis database in your project.
const redisClient = createClient({
    url: process.env.REDIS_URL
});

// Handle Redis connection errors.
redisClient.on('error', err => {
    console.error('Redis Client Error', err);
});

// Connect to Redis. The await is crucial here to ensure a connection is
// established before the server starts handling requests.
(async () => {
    try {
        await redisClient.connect();
        console.log('Successfully connected to Redis!');
    } catch (e) {
        console.error('Could not connect to Redis:', e);
    }
})();

app.use(express.json());

// Main route
app.get('/', (req, res) => {
    res.send('Welcome to the Railway Redis app! Try visiting /set/:key/:value or /get/:key.');
});

// Route to set a value in Redis
app.get('/set/:key/:value', async (req, res) => {
    const { key, value } = req.params;
    try {
        await redisClient.set(key, value);
        res.status(200).send(`Successfully set key: "${key}" with value: "${value}"`);
    } catch (error) {
        res.status(500).send(`Error setting key: "${key}". Error: ${error.message}`);
    }
});

// Route to get a value from Redis
app.get('/get/:key', async (req, res) => {
    const { key } = req.params;
    try {
        const value = await redisClient.get(key);
        if (value) {
            res.status(200).send(`The value for key "${key}" is: "${value}"`);
        } else {
            res.status(404).send(`Key "${key}" not found.`);
        }
    } catch (error) {
        res.status(500).send(`Error getting key: "${key}". Error: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
