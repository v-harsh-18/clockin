//jshint esversion:6
require('dotenv').config();
const cron = require('node-cron');
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
const nodemailer = require('nodemailer');
const axios = require('axios');
const { response } = require('express');
const { MongoNetworkTimeoutError } = require('mongodb');

const app = express();

app.use(express.static(__dirname + '/public'));
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

mongoose.connect(process.env.MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set("useCreateIndex", true);



const eventsSchema = new mongoose.Schema({
    _id: String,
    id: String,
    title: String,
    rrule: {
        dtstart: String,
        freq: String,
        until: String
    },
    start: String,
    duration: String,
    time: String,
    url: String,
    allDay: Boolean,
    startRecur: String,
    endRecur: String,
    description: String


})

const Event = new mongoose.model("Event", eventsSchema)

const userSchema = new mongoose.Schema({
    googleId: String,
    username: String,
    picture: String,
    fname: String,
    events: [eventsSchema],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
const User = new mongoose.model("User", userSchema);


var currentid = "";

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

let email = "";

passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "https://obscure-everglades-41187.herokuapp.com/auth/google/clockin",
        // callbackURL: "http://localhost:3003/auth/google/clockin",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        passReqToCallback: true,

    },
    function(req, accessToken, refreshToken, profile, cb) {


        console.log(profile);
        currentid = profile.id;
        req.session.new=profile.id;
        email = profile.emails[0].value;
        
        User.findOrCreate({ username: profile.emails[0].value, googleId: profile.id, picture: profile.photos[0].value, fname: profile.displayName }, function(err, user) {
            req.session.accessToken = accessToken;
            req.session.refreshToken = refreshToken
            return cb(err, user);
        });
    }
    ));
    



app.route("/")
    .get((req, res) => {
        res.render('home');
    });

app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', "email", "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"] }));

app.get("/auth/google/clockin",
    passport.authenticate('google', { failureRedirect: "/" }),
    function(req, res) {
        res.redirect("/calendar");
    });


app.get("/calendar", function(req, res) {



    if (req.isAuthenticated()) {
        User.findOne({ googleId: req.session.new}, async function(err, foundUser) {
            if (err) {
                console.log(err);
            } else {
                if (foundUser) {
                    foundUser.toObject();
                    var newEvents = [];
                    var vnone = [];
                    var vmisc = [];
                    var vbday = [];
                    var vofficial = [];
                    var vunofficial = [];
                   

                    for (let i = 0; i < foundUser.events.length; i++) {
                        var day = new Date(foundUser.events[i].rrule.until);
                        var nextDay = new Date(day);
                        nextDay.setDate(day.getDate() - 1);
                        if (foundUser.events[i].description === 'none') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDay();
                                let k = n+1;
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = 1;
                                if(m!=12){k=m+1}
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].start + `"`+ `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'official') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDay();
                                let k = n+1;
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = 1;
                                if(m!=12){k=m+1};
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].start + `"`+ `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'unofficial') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDay();
                                let k = n+1;
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = 1;
                                if(m!=12){k=m+1};
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].start + `"`+ `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'bday') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDay();
                                let k = n+1;
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = 1;
                                if(m!=12){k=m+1};
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].start + `"`+ `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'misc') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDay();
                                let k = n+1;
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                                
                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(`"` + foundUser.events[i].start + `"`);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = 1;
                                if(m!=12){k=m+1};
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].start + `"`+ `}`);
                            }

                        }

                    }
                    let calendarList;
                    let event;
                    let actualEvent;
                    try {
                        calendarList = await axios.get("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
                            headers: {
                                'Authorization': `Bearer ${req.session.accessToken}`
                            }
                        });
                    } catch (err) {
                        throw new Error('No calendar list');
                    }
                    
                    if (!calendarList.data) return res.render("calendar", { idpic: foundUser.picture, idname: foundUser.fname, events: foundUser.events, vnone: vnone, vofficial: vofficial, vunofficial: vunofficial, vbday: vbday, vmisc: vmisc });
                    let l = calendarList.data.items.length;
                   
                    for (let i = 0; i < l; i++) {
                        let Cid = calendarList.data.items[i].id;
                        try {
                            event = await axios.get('https://www.googleapis.com/calendar/v3/calendars/' + Cid + '/events', {
                                headers: {
                                    'Authorization': `Bearer ${req.session.accessToken}`
                                }
                            });

                        } catch (err) {
                            continue;
                        }


                        let gevents=event.data.items;

                        let guser = gevents.map((props,index) => {
                            const container = {};
                        
                            container._id= index;
                            container.id= index;
                            container.title= props.summary;
                            // rrule: {
                            //     dtstart: props.start.dateTime;
                            //     freq: 'daily';
                            //     until: props.end.dateTime;
                            // };
                            container.url= props.htmlLink;
                            if(props.start !== undefined){
                                if(props.start.dateTime === undefined)
                                {
                                    container.start= props.start.date;
                                    container.time = '08:00';
                                    container.allDay= 'true';
                                    container.startRecur= props.start.date;
                                    container.endRecur= props.end.date;
  
                                }
                                else{
                                    container.start= props.start.dateTime;
                                    container.duration= '01:00';
                                    container.time= props.start.dateTime;
                                    container.allDay= 'false';
                                    container.startRecur= props.start.dateTime;
                                    container.endRecur= props.end.dateTime;
  
                                }
                            }
                            else if(props.orignalStartTime !== undefined)
                            {
                                if(props.orignalStartTime.dateTime === undefined)
                                {
                                    container.start= props.orignalStartTime.date;
                                    container.time = '08:00';
                                    container.allDay= 'true';
                                    container.startRecur= props.orignalStartTime.date;
                                    container.endRecur= props.end.date;
  
                                }
                                else{
                                    container.start= props.orignalStartTime.dateTime;
                                    container.duration= '01:00';
                                    container.time= props.orignalStartTime.dateTime;
                                    container.allDay= 'false';
                                    container.startRecur= props.orignalStartTime.dateTime;
                                    container.endRecur= props.end.dateTime;
  
                                }
                            }
                            container.description= 'Google Calendar Event';

                            var index=index+1;
                        
                            return container;
                        });

                        newEvents=newEvents.concat(guser);
                    }

                    let length=newEvents.length;

                    res.render("calendar", { idpic: foundUser.picture, idname: foundUser.fname, gevents: newEvents, events: foundUser.events, vnone: vnone, vofficial: vofficial, vunofficial: vunofficial, vbday: vbday, vmisc: vmisc, length:length});
                }
            }
        });
    } else {
        res.redirect('/');
    }
});
let descp = "";
let dte = "";
let tm = "";

var vnone = [];
app.post("/calendar", function(req, res) {

    
    const title = req.body.title;
    const date = req.body.date;
    const time = req.body.time;
    const link = req.body.link;
    const id = new Date;
    let dtstart;
    let freq;
    let until;
    let new1;
    let new2;
    const description = req.body.description;
    const repeat = req.body.repeat;
    if (req.body.repeat !== "none") {
        var day=new Date(req.body.until);
        var nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        dtstart = req.body.date;
        freq = req.body.repeat;
        until = nextDay.toISOString();

    };
    tm = req.body.time;
    let min = "";
    let hr = "";
    let mnth = "";
    let wk = "";

    hr = tm[0] + tm[1];
    min = tm[3] + tm[4];
    dt = req.body.date[8] + req.body.date[9];
    mnth = req.body.date[5] + req.body.date[6];

    wk = id.getDay();
    let output = ``;
    let remind = ``;

    if(link !== "")
    {
     output = `
    <div style="background-color: #e1f2ee">
        <h1 style="text-align: center">You have a new event scheduled !!</h1>
        <h2 style="font-size:2em; text-align: center">Event Details</h2>
          <p style="font-size:1.2em ; text-align: center;"><b>Title:</b> ${req.body.title}</p>
          <p style="font-size:1.2em; text-align: center;"><b>Date:</b> ${req.body.date}</p>
          <p style="font-size:1.2em; text-align: center;"><b>Time:</b> ${req.body.time}</p>
          <p style="font-size: 1.2em; text-align: center;"><b>Link:</b> ${req.body.link}</p>
          <p style="text-align: center;">You will receive a reminder before the start of the scheduled event.</p>
          <p style="text-align: center;">This is an auto-generated mail. Please do not reply.</p>
          </div>
  `;

    remind = `
    <div style="background-color: #e1f2ee ;">
            <h1 style="text-align: center;">Reminder !!</h1>
            <h2 style="font-size:2em; text-align: center;">Event Details</h2>
              <p style="font-size:1.2em ; text-align: center;"><b>Title:</b> ${req.body.title}</p>
              <p style="font-size:1.2em ; text-align: center;"><b>Date:</b> ${req.body.date}</p>
              <p style="font-size:1.2em ; text-align: center;"><b>Time:</b> ${req.body.time}</p>
              <p style="font-size: 1.2em; text-align: center;"><b>Link:</b> ${req.body.link}</p>
              <p style="text-align: center;">This is an auto-generated mail. Please do not reply.</p>  
            </div>    
  `;
    }
    else
    {
    output = `
    <div style="background-color: #e1f2ee">
        <h1 style="text-align: center">You have a new event scheduled !!</h1>
        <h2 style="font-size:2em; text-align: center">Event Details</h2>
          <p style="font-size:1.2em ; text-align: center;"><b>Title:</b> ${req.body.title}</p>
          <p style="font-size:1.2em; text-align: center;"><b>Date:</b> ${req.body.date}</p>
          <p style="font-size:1.2em; text-align: center;"><b>Time:</b> ${req.body.time}</p>
          <p style="text-align: center;">You will receive a reminder before the start of the scheduled event.</p>
          <p style="text-align: center;">This is an auto-generated mail. Please do not reply.</p>
          </div>
  `;

    remind = `
    <div style="background-color: #e1f2ee ;">
            <h1 style="text-align: center;">Reminder !!</h1>
            <h2 style="font-size:2em; text-align: center;">Event Details</h2>
              <p style="font-size:1.2em ; text-align: center;"><b>Title:</b> ${req.body.title}</p>
              <p style="font-size:1.2em ; text-align: center;"><b>Date:</b> ${req.body.date}</p>
              <p style="font-size:1.2em ; text-align: center;"><b>Time:</b> ${req.body.time}</p>
              <p style="text-align: center;">This is an auto-generated mail. Please do not reply.</p>  
            </div>    
  `;
    }

    let transporter = nodemailer.createTransport({
        service: 'gmail',

        port: 587,
        secure: false,
        auth: {
            user: 'clockin.india@gmail.com',
            pass: process.env.PASSWORD,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    let mailOptions = {
        from: '"ClockIn India" <clockin.india@gmail.com>',
        to: email,
        subject: 'Event Created',
        text: 'Hello world?',
        html: output
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log(error);
        }
        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

        res.render('contact', { msg: 'Email has been sent' });
    });
    

    const event = new Event({
        title: title,
        start: date+'T'+time+':00',
        time: time,
        url: link,
        _id: id,
        id: id,
        duration: '01:00',
        allDay: false,
        description: description,
        rrule: {
            dtstart: dtstart+'T'+time+":00",
            freq: freq,
            until: until
        },

    })

    User.findOne({ googleId: req.session.new}, function(err, foundUser) {
        foundUser.events.push(event);
        foundUser.save();
        res.redirect("/calendar");
    });


    cron.schedule(min + " " + hr + " " + dt + " " + mnth + " " + '*', function() {

        let mailOptions = {
            from: '"ClockIn India" <clockin.india@gmail.com>',
            to: email,
            subject: 'Reminder',
            text: 'Hello world?',
            html: remind,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                return console.log(error);
            }
            console.log('Message sent: %s', info.messageId);
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));

            res.render('contact', { msg: 'Email has been sent' });
        });
    });

});

app.post("/delete", function(req, res) {
    const idi = req.body.idi;

    if(Number.isInteger(parseInt(idi)))
    {
        res.redirect('/calendar');
    }
    else{
    User.findOne({ googleId: req.session.new}, function(err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            let vuser = foundUser.events.id(idi);
            foundUser.events.pull({ id: idi });
            foundUser.save();
            res.redirect('/calendar');

            dte = vuser.start;
            dte = `'` + dte + `'`
            descp = vuser.description;
        }
    })
    }
});


app.listen(process.env.PORT || 3003, () => {
    console.log('CONNECTION ESTABLISHED ON PORT 3003')
});