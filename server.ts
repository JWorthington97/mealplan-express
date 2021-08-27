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
app.get("/", async (req, res) => {
  res.status(200).json({message: "Mealplan API"})
})

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
app.get("/recipes/:userId", async (req, res) => {
  try {
    // const dbres = await client.query("SELECT * FROM recipes")
    const dbres = await client.query(`
    SELECT 
      r.id,
      r.name,
      c.id as cuisine,
      r.url,
        r.image_url,
      string_agg(tag, ', ') AS tags,
        CASE
          WHEN f.user_id = $1 THEN 1
            ELSE 0
        END AS infavourites,
        CASE
          WHEN s.recipe_id IS NOT NULL THEN 1
            ELSE 0
        END AS specials
    FROM recipes r
      INNER JOIN recipe_tags rt
        ON rt.recipe_id = r.id
      INNER JOIN tags t
        ON t.id = rt.tag_id
      INNER JOIN cuisines c
        ON c.id = r.cuisine_id
      LEFT JOIN favourites f
          ON f.recipe_id = r.id AND f.user_id = $1
      LEFT JOIN specials s
      		ON s.recipe_id = r.id AND s.week = $2 AND s.year = $3
    GROUP BY 
      r.id,
      r.name,
      c.id,
      r.url,
      r.image_url,
      f.id,
      s.recipe_id;`, [req.params.userId, dayjs().isoWeek(), dayjs().year()]
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
app.get("/specials/:userId", async (req, res) => {
  try {
    const {rows} = await client.query(`
    SELECT 
      r.id,
      r.name,
      c.cuisine,
      r.url,
      r.image_url,
      string_agg(tag, ', ') AS tags,
      CASE
        WHEN f.user_id = $3 THEN 1
          ELSE 0
      END AS infavourites
    FROM recipes r
      INNER JOIN recipe_tags rt
        ON rt.recipe_id = r.id
      INNER JOIN tags t
        ON t.id = rt.tag_id
      INNER JOIN cuisines c
        ON c.id = r.cuisine_id
        INNER JOIN specials s
          ON s.recipe_id = r.id
        LEFT JOIN favourites f
          ON f.recipe_id = r.id AND f.user_id = $3
        WHERE s.week = $1 AND s.year = $2
    GROUP BY 
      r.id,
      r.name,
      c.cuisine,
      r.url,
        r.image_url,
        r.image_url,
        f.user_id;`, [dayjs().isoWeek(), dayjs().year(), req.params.userId]
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
app.get("/recipe/tags", async (req, res) => {
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

//Favourites
app.post("/favourites", async (req, res) => {
  const recipeID = req.body.recipeID 
  const userID = req.body.userID 
  
  try {
    const response = await client.query("INSERT INTO favourites (recipe_id, user_id) VALUES ($1, $2)", [recipeID, userID])
    res.status(201).json({message: "Favourite added"})
  }
  catch (ex) {
    console.log(ex.message)
    res.status(401).json({message: ex.message})
  }
})


app.delete("/favourites", async (req, res) => {
  try {
    const { userID, recipeID } = req.body
    const dbres = await client.query("DELETE FROM favourites WHERE recipe_id = $1 and user_id = $2 RETURNING *", [recipeID, userID])
    console.log(dbres.rows)
    res.status(200).json({
      message: "Favourite removed"
    })
  }
  catch (error) {
    console.log(error.message)
    res.status(400).json({
      message: "Unable to remove favourite"
    })
  }
})