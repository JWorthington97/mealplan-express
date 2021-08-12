import { Client } from "pg";
import { config } from "dotenv";
import express from "express";
import cors from "cors";
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
dayjs.extend(isoWeek)

config(); //Read .env file lines as though they were env vars.

//Call this script with the environment variable LOCAL set if you want to connect to a local db (i.e. without SSL)
//Do not set the environment variable LOCAL if you want to connect to a heroku DB.

//For the ssl property of the DB connection config, use a value of...
// false - when connecting to a local DB
// { rejectUnauthorized: false } - when connecting to a heroku DB
const herokuSSLSetting = { rejectUnauthorized: false }
const sslSetting = process.env.LOCAL ? false : herokuSSLSetting
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: sslSetting,
};

const app = express();

app.use(express.json()); //add body parser to each following route handler
app.use(cors()) //add CORS support to each following route handler

const client = new Client(dbConfig);
client.connect();

//Start the server on the given port
const port = process.env.PORT;
if (!port) {
  throw 'Missing PORT environment variable.  Set it in .env file.';
}
app.listen(port, () => {
  console.log(`Server is up and running on port ${port}`);
});

// Routes

//Cuisines
app.get("/cuisines", async (req, res) => {
  try {
    const dbres = await client.query('SELECT * FROM cuisines');
    res.json(dbres.rows);
  }
  catch (ex) {
    res.json({
      status: ex.message
    })
  }
});

app.post("/cuisines", async (req, res) => {
  // try await client.query("INERT INTO cuisines (cuisine) VALUES ($1), $1.toLowerCase())
  // catch unable to insert ex.message (will be duplicate)
  res.json({message: "Creating new cuisines is not currently implemented."})
})

// Recipes
app.get("/recipes", async (req, res) => {
  console.log(dayjs().isoWeek())
  try {
    // const dbres = await client.query("SELECT * FROM recipes")
    const dbres = await client.query(`
    SELECT 
      r.id,
      r.name,
      c.cuisine,
      r.url,
      r.image_url,
      string_agg(tag, ', ') AS tags
    FROM recipes r
      INNER JOIN recipe_tags rt
        ON rt.recipe_id = r.id
      INNER JOIN tags t
        ON t.id = rt.tag_id
      INNER JOIN cuisines c
        ON c.id = r.cuisine_id
    GROUP BY 
      r.id,
      r.name,
      c.cuisine,
      r.url,
        r.image_url;`
        )
    res.json(dbres.rows)
  }
  catch (ex) {
    res.json({
      status: ex.message
    })
  }
})

app.post("/recipes", async (req, res) => {
  // provide a JSON body here
  // TO LOWER CASE TOO
  res.json({
    status: "Adding a new recipe is not currently implemented."
  })
})

// Specials
app.get("/specials", async (req, res) => {
  try {
    const {rows} = await client.query(`
    SELECT 
      r.id,
      r.name,
      c.cuisine,
      r.url,
        r.image_url,
      string_agg(tag, ', ') AS tags
    FROM recipes r
      INNER JOIN recipe_tags rt
        ON rt.recipe_id = r.id
      INNER JOIN tags t
        ON t.id = rt.tag_id
      INNER JOIN cuisines c
        ON c.id = r.cuisine_id
        INNER JOIN specials s
          ON s.recipe_id = r.id
        WHERE s.week = $1 AND s.year = $2
    GROUP BY 
      r.id,
      r.name,
      c.cuisine,
      r.url,
        r.image_url;`, [dayjs().isoWeek(), dayjs().year()]
        )
      res.status(200).json(rows)
  }
  catch (ex) {
    console.log(ex.message)
    res.status(400).json({
      message: "unable to retrieve specials"
    })
  }
})

//Recipe Tags
app.get("/recipetags", async (req, res) => {
  try {
    const dbres = await client.query(`
    SELECT t.tag
    FROM recipes r
      INNER JOIN recipe_tags rt
        ON rt.recipe_id = r.id
      INNER JOIN tags t
        ON t.id = rt.tag_id
    WHERE r.id = $1;`, [req.body.recipe_id])
    if (dbres.rows.length > 0) {
      res.json(dbres.rows)
    }
    else {
      res.json({message: "No results found."})
    }
  }
  catch (ex) {
    res.json({
      status: ex.message
    })
  }
})