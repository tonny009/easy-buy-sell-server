const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5001;
const app = express();
app.use(cors()); 0
app.use(express.json());

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// console.log('key is :', process.env.STRIPE_SECRET_KEY);

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
        const bookingCollection = client.db('easyBuySell').collection('booking');
        const paymentsCollection = client.db('easyBuySell').collection('payments');




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

        //all category list
        app.get('/categories', async (req, res) => {
            const query = {}
            const categories = await categoryCollection.find(query).toArray();
            res.send(categories)
        })

        // get all products based on advertise and reported ---------
        app.get('/products', verifyJWT, async (req, res) => {
            var query = {};
            console.log(req.query);
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            else {
                if (req.query.advertise) {
                    query = { advertise: req.query.advertise };
                }
                if (req.query.report) {
                    query = { report: req.query.report };
                }
                const products = await productsCollection.find(query).toArray();
                res.send(products);

            }
        }
        )
        // get all products or based on category ---------
        app.get('/catproducts', async (req, res) => {
            var query = {};
            console.log(req.query);
            if (req.query.category) {
                query = { category: req.query.category };
            }
            const products = await productsCollection.find(query).toArray();
            res.send(products);
        });

        // get all reported products (only for admin)-----------
        app.get('/reportproducts', verifyJWT, verifyAdmin, async (req, res) => {
            var query = {};
            if (req.query.report) {
                query = { report: req.query.report };
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

        // Update users verify status  -----
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
            console.log(user);
            res.send(user)
        })

        // Fot getting user status verify or not for blue tik------
        app.get('/userStatus/:email', async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)
            console.log(user);
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

        // Get seller's products ----------
        app.get('/products/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const decodedEmail = req.decoded.email

            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = {
                email: email,
            }
            const cursor = productsCollection.find(query)
            const products = await cursor.toArray()
            res.send(products)
        })

        // Delete the product -------------
        app.delete('/product/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await productsCollection.deleteOne(query)
            res.send(result)
        })

        //Update a product with status--------
        app.put('/product/:id', async (req, res) => {
            const id = req.params.id
            const updateStatus = req.body

            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: updateStatus
            }
            const result = await productsCollection.updateOne(filter, updateDoc, options)
            console.log(result)
            res.send(result)
        })

        // Get a single product
        app.get('/singleproduct/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const product = await productsCollection.findOne(query)
            console.log('This is -----------', product);
            res.send(product)
        })


        //Booking data posting in database-------
        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        })

        // Get orders
        app.get('/bookings', verifyJWT, async (req, res) => {
            let query = {}
            const email = req.query.email
            const decodedEmail = req.decoded.email
            if (email !== decodedEmail) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            if (email) {
                query = {
                    buyerEmail: email,
                }
            }
            const cursor = await bookingCollection.find(query)
            const bookings = await cursor.toArray()
            res.send(bookings)
        })

        // for getting specific booking ---------
        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const booking = await bookingCollection.findOne(query);
            res.send(booking);
        })

        //all for payment sections.......
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body;
            const price = booking.price;
            const amount = price * 100;
            console.log(price);

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                "payment_method_types": [
                    "card"
                ]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })

        //set payment details in db-------------
        app.post('/payments', async (req, res) => {
            console.log('Payment Details:', req.body);
            const payment = req.body;
            const result = await paymentsCollection.insertOne(payment);

            //this is to update booking details
            const id = payment.bookingId
            const filter = { _id: ObjectId(id) }
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const updatedResult = await bookingCollection.updateOne(filter, updatedDoc)
            res.send(result);
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