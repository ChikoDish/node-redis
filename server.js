const express = require("express");
const responseTime = require("response-time");
const axios = require("axios");
const redis = require("redis");

const app = express();

//create and connect redis client to local instance
const client = redis.createClient();

//Prient redis errors to the console
client.on("error", (err) => {
  console.error(err);
});

//use response-tiem as middleware
app.use(responseTime());

app.get("/api/search", (req, res) => {
  //Extract the query from url and trim trailing spaces
  const query = req.query.query.trim();

  //Build the wiki API url
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=parse&format=json&section=0&page=${query}`;

  //Try feching the result from Redis forst in case we have it cached
  return client.get(`wikipedia:${query}`, (err, result) => {
    //If that key exist in Redis store it
    if (result) {
      const resultJSON = JSON.parse(result);
      return res.status(200).json(resultJSON);
    } else {
      //key doesn't exist in Redis store'
      //Fetch directly from wikipedia API
      return axios
        .get(searchUrl)
        .then((response) => {
          const responseJSON = response.data;
          // Save the Wikipedia API response in Redis store
          client.setex(
            `wikipedia:${query}`,
            3600,
            JSON.stringify({ source: "Redis Cache", ...responseJSON })
          );
          // Send JSON response to client
          return res
            .status(200)
            .json({ source: "Wikipedia API", ...responseJSON });
        })
        .catch((err) => {
          return res.json(err);
        });
    }
  });
});

app.listen(3000, () => {
  console.log(`server listening on port: 3000`);
});
