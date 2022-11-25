const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5001;
const app = express();
app.use(cors()); 0
app.use(express.json());


var uri = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@ac-1bjla5v-shard-00-00.dieisxt.mongodb.net:27017,ac-1bjla5v-shard-00-01.dieisxt.mongodb.net:27017,ac-1bjla5v-shard-00-02.dieisxt.mongodb.net:27017/?ssl=true&replicaSet=atlas-n02o7o-shard-0&authSource=admin&retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
console.log(uri);



function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('unauthorized access');
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next();
    })

}
async function run() {
    try {
        const categoryCollection = client.db('easyBuySell').collection('categories');
        const usersCollection = client.db('easyBuySell').collection('users');
        const productsCollection = client.db('easyBuySell').collection('products');
        // const usersCollection = client.db('easyBuySell').collection('users');

        // NOTE: make sure you use verifyAdmin after verifyJWT
        const verifyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email;
            const query = { email: decodedEmail };
            const user = await usersCollection.findOne(query);
            console.log('role is ----: ', user.role);

            if (user?.role !== 'admin') {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next();
        }


        app.get('/categories', async (req, res) => {
            const query = {}
            const categories = await categoryCollection.find(query).toArray();
            res.send(categories)
        })

        // get all products or based on category ---------
        app.get('/products', async (req, res) => {
            var query = {};
            if (req.query.category) {
                query = { category: req.query.category };
            }
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });

        // get type wise users-----
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            var query = {};
            if (req.query.role) {
                query = { role: req.query.role };
            }
            const users = await usersCollection.find(query).toArray();
            res.send(users);
        });

        // get all users--------
        // app.get('/users', async (req, res) => {
        //     const query = {}
        //     const cursor = usersCollection.find(query)
        //     const users = await cursor.toArray()
        //     res.send(users)
        // })

        // Get Single category all products
        // app.get('/home/:id', async (req, res) => {
        //     const id = req.params.id
        //     const query = { _id: ObjectId(id) }
        //     const home = await homesCollection.findOne(query)
        //     res.send(home)
        // })

        // ----for log in and sign up--------
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body

            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1d',
            })
            console.log(result)
            res.send({ result, token })
        })

        // Update users details -----
        app.put('/userupdate/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email
            const user = req.body

            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            }
            const result = await usersCollection.updateOne(filter, updateDoc, options)


            console.log(result)
            res.send(result)
        })


        // Get A Single User
        app.get('/user/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            res.send(user)
        })



        // delete user ---------

        app.delete('/users/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query)
            res.send(result)

        })


        //products added-----
        app.post('/products', async (req, res) => {
            const product = req.body
            console.log(product)
            const result = await productsCollection.insertOne(product)
            res.send(result)
        })

    }
    finally {

    }
}
run().catch(console.log);

app.get('/', async (req, res) => {
    res.send('Easy Buy and sell server is running');
})

app.listen(port, () => console.log(`Easy Buy and sell  running on ${port}`))