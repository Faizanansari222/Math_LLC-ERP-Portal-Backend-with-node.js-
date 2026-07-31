import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.get("/users", (req, res) => {
  
  const data = [
    {
      name: "John Doe",
      age: 30,
    },
    {
      name: "Jane Doe",
      age: 25,
    },
    {
      name: "Bob Smith",
      age: 40,
    },
    {
      name: "Alice Johnson",
      age: 35,
    },
  ]
    res.send(data);
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
