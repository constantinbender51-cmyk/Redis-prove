const express = require('express');
const { createClient } = require('redis');
const cheerio = require('cheerio');

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

// Route to fetch content from a URL, extract text, and save it to Redis with a new timestamped key
app.get('/fetch-and-save', async (req, res) => {
    const urlToFetch = 'https://noise-remover-production-8534.up.railway.app/architects/';
    const timestamp = Date.now();
    const redisKey = `architects-content-text-${timestamp}`;

    try {
        const response = await fetch(urlToFetch);
        if (!response.ok) {
            throw new Error(`Failed to fetch URL with status: ${response.status} ${response.statusText}`);
        }
        const htmlContent = await response.text();
        const $ = cheerio.load(htmlContent);
        const textContent = $('pre').text(); // Select the <pre> tag and get its text

        await redisClient.set(redisKey, textContent);
        res.status(200).send(`Successfully fetched content from ${urlToFetch}, extracted text, and saved to a new Redis key: "${redisKey}"`);
    } catch (error) {
        console.error('Error fetching and saving content:', error);
        res.status(500).send(`Error fetching or saving content. Error: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
