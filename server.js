//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const MongoClient = require("mongodb").MongoClient;

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Our liitle secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/UserDB", { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);

const eventSchema = new mongoose.Schema({
    title: String,
    date: Date,
    time: String,
    link:String,
    repeat: String

})

const userSchema = new mongoose.Schema({
    googleId: String,
    username: String,
    picture: String,
    fname: String,
    events:[eventSchema]
    
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);
var currentid = "";

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
        done(err, user);
    });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3003/auth/google/clockin",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        currentid = profile.id;

        User.findOrCreate({ username: profile.emails[0].value, googleId: profile.id, picture: profile.photos[0].value, fname: profile.displayName }, function (err, user) {
            return cb(err, user);
        });
    }
));



app.route("/")
    .get((req, res) => {
        res.render('home');
    });

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', "email"] }));

app.get("/auth/google/clockin",
    passport.authenticate('google', { failureRedirect: "/" }),
    function (req, res) {
        res.redirect("/calendar");
    });


app.get("/calendar", function (req, res) {



    //     User.findOne({ "secret": { $ne: null } }, function (err, foundUsers) {
    //         if (err) {
    //             console.log(err);
    //         } else {
    //             if (foundUsers) {
    // res.render("calendar", { usersWithSecrets: foundUsers });
    // res.render("calendar");
    //             }
    //         }
    //     });
    // }

    if (req.isAuthenticated()) {
        User.findOne({ googleId: currentid }, function (err, foundUser) {
            if (err) {
                console.log(err);
            } else {
                if (foundUser) {
                    foundUser.toObject();
                    // console.log("heloooooooooo" + foundUser.fname)
                    res.render("calendar", { idpic: foundUser.picture, idname: foundUser.fname });
                }
            }
        });
    }
    else {
    res.redirect('/');
    }
});

app.post("/event" , function(req,res){
    User.findOne({ googleId: currentid }, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                foundUser.events[0].title=req.body.title;
                // foundUser.title=req.body.title;
                // foundUser.title=req.body.title;
                // foundUser.title=req.body.title;
                // foundUser.title=req.body.title;
                
            }
        }
    });
                
});

// app.post('/remindar', function(req, res){
//     console.log(req.body);
// });

// MongoClient.connect("mongodb+srv://ClockIn:vahi_wahi@cluster0.xpnz4.mongodb.net/myFirstDatabase?retryWrites=true&w=majority", 
// { useUnifiedTopology: true},
// function(err, client){
//     if(err) return console.error(err)
//     console.log('Connected to Database');
//     const db = client.db('Calendar');
//     const reminderCollection = db.collection('reminder');
//     app.post('/reminder', (req, res) => {
//         reminderCollection.insertOne(req.body)
//           .then(result => {
//             console.log(result)
//           })
//           .catch(error => console.error(error))
//       })
//       app.post('/reminder', (req, res) => {
//         reminderCollection.insertOne(req.body)
//           .then(result => {
//             res.redirect('/')
//           })
//           .catch(error => console.error(error))
//       })
// })


app.listen(3003, () => {
    console.log('CONNECTION ESTABLISHED ON PORT 3003')
});
