import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { redis } from './redis-client.js';
import fetch from 'node-fetch';

const __dirname = path.resolve();

const app = express();

app.use(express.json());

app.post('/data', async (req, res) => {
  try {
    const { repository } = req.body;

    const timeStart = Date.now();

    if (!repository) {
      throw 'Repository name was not provided';
    }

    const value = await redis.get(repository);

    if (value) {
      res.send({
        from: 'cache',
        status: 'ok',
        stars: value,
        time: Date.now() - timeStart,
      });

      const response = await fetch(
        `https://api.github.com/repos/${repository}`
      );
      const parsedReponse = await response.json();

      if (parsedReponse.stargazers_count != undefined) {
        await redis.setex(repository, 30, parsedReponse.stargazers_count);
      }

      return;
    }

    const response = await fetch(`https://api.github.com/repos/${repository}`);
    const parsedReponse = await response.json();
    if (parsedReponse.stargazers_count != undefined) {
      await redis.setex(repository, 30, parsedReponse.stargazers_count);
    }

    res.send({
      from: 'remote',
      status: 'ok',
      stars: parsedReponse.stargazers_count,
      time: Date.now() - timeStart,
    });
  } catch (err) {
    res.status(500).send({ err });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(3000);
