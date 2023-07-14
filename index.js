require('dotenv').config();
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

const cors = require('cors');

app.use(cors());
app.use(express.json());

const uri = process.env.DATABASE_URL;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    const db = client.db('technet-server-L2');
    const bookCollection = db.collection('books');
    const userCollection = db.collection('users');

    app.get('/books', async (req, res) => {
      const cursor = bookCollection.find({});
      const book = await cursor.toArray();

      res.send({ status: true, data: book });
    });

    app.get('/books/last-ten', async (req, res) => {
      const cursor = bookCollection.find({}).sort({ createdAt: -1 }).limit(10);
      const book = await cursor.toArray();

      res.send({ status: true, data: book });
    });

    app.post('/book', async (req, res) => {
      let book = req.body;
      book.reviews = [];
      book.createdAt = new Date();

      const result = await bookCollection.insertOne(book);

      res.send(result);
    });

    app.get('/book/:id', async (req, res) => {
      const id = req.params.id;

      const result = await bookCollection.findOne({ _id: ObjectId(id) });
      console.log(result);
      res.send(result);
    });

    app.patch('/book/:id', async (req, res) => {
      const id = req.params.id;

      const updates = req.body;

      const result = await bookCollection.updateOne(
          { _id: ObjectId(id) },
          { $set: updates }
      );

      console.log(result);
      res.send(result);
    });

    app.patch('/book/add-review/:id', async (req, res) => {
      const id = req.params.id;

      const review = req.body.review;

      const result = await bookCollection.updateOne(
          { _id: ObjectId(id) },
          {
            $push: {
              reviews: {
                $each: [review],
                $position: 0
              }
            }
          }
      );

      console.log(result);
      res.send(result);
    });

    app.delete('/book/:id', async (req, res) => {
      const id = req.params.id;

      const result = await bookCollection.deleteOne({ _id: ObjectId(id) });
      console.log(result);
      res.send(result);
    });

    app.post('/comment/:id', async (req, res) => {
      const bookId = req.params.id;
      const comment = req.body.comment;

      console.log(bookId);
      console.log(comment);

      const result = await bookCollection.updateOne(
        { _id: ObjectId(bookId) },
        { $push: { comments: comment } }
      );

      console.log(result);

      if (result.modifiedCount !== 1) {
        console.error('book not found or comment not added');
        res.json({ error: 'book not found or comment not added' });
        return;
      }

      console.log('Comment added successfully');
      res.json({ message: 'Comment added successfully' });
    });

    app.get('/comment/:id', async (req, res) => {
      const bookId = req.params.id;

      const result = await bookCollection.findOne(
        { _id: ObjectId(bookId) },
        { projection: { _id: 0, comments: 1 } }
      );

      if (result) {
        res.json(result);
      } else {
        res.status(404).json({ error: 'book not found' });
      }
    });

    app.post('/user', async (req, res) => {
      const user = req.body;

      const result = await userCollection.insertOne(user);

      res.send(result);
    });

    app.get('/user/:email', async (req, res) => {
      const email = req.params.email;

      const result = await userCollection.findOne({ email });

      if (result?.email) {
        return res.send({ status: true, data: result });
      }

      res.send({ status: false });
    });

    app.get('/wishlist/:userEmail', async (req, res) => {
      const email = req.params?.userEmail;

      const result = await userCollection.aggregate([
        { $match: { email: email } },
        { $unwind: "$wishlist" },
        {
          $lookup:
              {
                from: "books",
                localField: "wishlist",
                foreignField: "_id",
                as: "bookDetails"
              }
        },
        {
          $group: {
            _id: "$email",
            wishlist: { $push: { $arrayElemAt: ["$bookDetails", 0] } }
          }
        },
        {
          $project: {
            _id: 0,
            wishlist: 1
          }
        }
      ]).toArray();

      if (result.length) {
        res.json(result[0]);
      } else {
        res.status(404).json({ error: 'user not found' });
      }
    });

    app.post('/wishlist', async (req, res) => {
      const userId = req.params.userId;
      const bookId = req.body?.bookId;
      const userEmail = req.body?.userEmail

      console.log(bookId, userEmail)
      const isWishlistExitsForUser = await userCollection.findOne({ email: userEmail });
      if(!isWishlistExitsForUser) {
        const result = await userCollection.insertOne({ email: userEmail, wishlist: [bookId] });
        return res.send(result);
      }
      else {
        const result = await userCollection.updateOne(
            { email: userEmail },
            { $addToSet: { wishlist: ObjectId(bookId) } }
        );
        res.send(result);
      }
    });

    app.delete('/wishlist/:userEmail/:bookId', async (req, res) => {
      const userEmail = req.params?.userEmail;
      const bookId = req.params?.bookId;
      console.log(userEmail, bookId)

      let result = await userCollection.updateOne(
          { email: userEmail },
          { $pull: { wishlist: ObjectId(bookId) } }
      );

      result = await userCollection.aggregate([
        { $match: { email: userEmail } },
        { $unwind: "$wishlist" },
        {
          $lookup:
              {
                from: "books",
                localField: "wishlist",
                foreignField: "_id",
                as: "bookDetails"
              }
        },
        {
          $group: {
            _id: "$email",
            wishlist: { $push: { $arrayElemAt: ["$bookDetails", 0] } }
          }
        },
        {
          $project: {
            _id: 0,
            wishlist: 1
          }
        }
      ]).toArray();

      if (result.length) {
        res.json(result[0]);
      } else {
        res.status(404).json({ error: 'user not found' });
      }

      res.send(result);
    });

  }
  catch (err) {
    console.log(err);
    res.status(500).send({ message: err.message });
  }
  finally {

  }
};

run().catch((err) => console.log(err));

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
