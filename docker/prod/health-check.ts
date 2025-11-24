#!/usr/bin/env node
import * as http from 'http';

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const options: http.RequestOptions = {
  hostname: 'localhost',
  port,
  path: '/health',
  method: 'GET',
  timeout: 3000,
};

const req = http.request(options, (res: http.IncomingMessage) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on('error', () => {
  process.exit(1);
});

req.on('timeout', () => {
  req.destroy();
  process.exit(1);
});

req.end();
