const express = require('express');
const { createClient } = require('redis');
const fetch = require('node-fetch');

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
app.get('/', async (req, res) => {
    try {
        // Get all keys from Redis
        const keys = await redisClient.keys('*');
        
        let htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Redis Key Viewer</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; text-align: center; }
                    .button-container { margin-top: 20px; }
                    .key-button {
                        padding: 10px 15px;
                        margin: 5px;
                        cursor: pointer;
                        background-color: #007bff;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        font-size: 16px;
                    }
                    .key-button:hover { background-color: #0056b3; }
                    #value-display {
                        margin-top: 20px;
                        border: 1px solid #ccc;
                        padding: 15px;
                        background-color: #f9f9f9;
                        min-height: 50px;
                        text-align: left;
                    }
                    h1 { color: #333; }
                </style>
            </head>
            <body>
                <h1>Redis Key Viewer</h1>
                <p>Click a button below to view its value.</p>
                <div class="button-container">
        `;

        if (keys.length > 0) {
            keys.forEach(key => {
                htmlContent += `<button class="key-button" onclick="loadValue('${key}')">${key}</button>`;
            });
        } else {
            htmlContent += `<p>No keys found in Redis. Try setting some at <a href="/set/mykey/myvalue">/set/mykey/myvalue</a> or by visiting <a href="/fetch-and-save">/fetch-and-save</a>.</p>`;
        }
        
        htmlContent += `
                </div>
                <div id="value-display">Select a key to see its value here.</div>

                <script>
                    async function loadValue(key) {
                        const display = document.getElementById('value-display');
                        display.innerHTML = 'Loading...';
                        try {
                            const response = await fetch(\`/get-value/\${key}\`);
                            if (!response.ok) {
                                throw new Error('Failed to fetch value');
                            }
                            const data = await response.json();
                            display.innerText = data.value || 'Key not found.';
                        } catch (error) {
                            display.innerText = 'Error fetching value.';
                            console.error(error);
                        }
                    }
                </script>
            </body>
            </html>
        `;
        res.send(htmlContent);

    } catch (error) {
        res.status(500).send(`Error retrieving keys from Redis. Error: ${error.message}`);
    }
});

// New route to get a value from Redis and return as JSON
app.get('/get-value/:key', async (req, res) => {
    const { key } = req.params;
    try {
        const value = await redisClient.get(key);
        if (value) {
            res.status(200).json({ value });
        } else {
            res.status(404).json({ value: null });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error getting value.' });
    }
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
    const urlToFetch = 'https://deepseek-author-production.up.railway.app/';
    const timestamp = Date.now();
    const redisKey = `content-${timestamp}`;

    try {
        const response = await fetch(urlToFetch);
        if (!response.ok) {
            throw new Error(`Failed to fetch URL with status: ${response.status} ${response.statusText}`);
        }
        const htmlContent = await response.text();
        
        // Use string manipulation to extract the content from the <pre> tag
        const startIndex = htmlContent.indexOf('<pre>') + 5;
        const endIndex = htmlContent.indexOf('</pre>', startIndex);
        const textContent = htmlContent.substring(startIndex, endIndex).trim();

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
