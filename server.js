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

app.use(express.static('public'));
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
    description: String,
    textColor: String,
    borderColor: String

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


passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,

        // callbackURL: "http://localhost:3003/auth/google/clockin",
        callbackURL: "https://clockin-india.herokuapp.com/auth/google/clockin",

        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        passReqToCallback: true,

    },
    function(req, accessToken, refreshToken, profile, cb) {


        console.log(profile);
        currentid = profile.id;
        req.session.new=profile.id;
        req.session.email = profile.emails[0].value;
        
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
                    var vgcal = [];
                   

                    for (let i = 0; i < foundUser.events.length; i++) {
                        var day = new Date(foundUser.events[i].rrule.until);
                        var nextDay = new Date(day);
                        nextDay.setDate(day.getDate() - 1);
                        if (foundUser.events[i].description === 'none') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                var d = new Date(foundUser.events[i].start);
                                var n = d.getDay();
                                let k = n+1;
                                
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDate();
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date(foundUser.events[i].start);
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = m+1;
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vnone.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].start + `"`+ `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'official') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDay();
                                let k = n+1;
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDate();
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = m+1;
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].start + `"`+ `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'unofficial') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDay();
                                let k = n+1;
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDate();
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = m+1;
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vunofficial.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].start + `"`+ `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'bday') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDay();
                                let k = n+1;
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDate();
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = m+1;
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vbday.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].start + `"`+ `}`);
                            }

                        }
                        if (foundUser.events[i].description === 'misc') {
                            if (foundUser.events[i].rrule.freq === 'daily') {
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `}`);
                            } else if (foundUser.events[i].rrule.freq === 'weekly') {
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDay();
                                let k = n+1;
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `weekdays :` + `[` + k + `]` + `}`);

                            } else if (foundUser.events[i].rrule.freq === 'monthly') {
                                let l = 1;
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDate();
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `monthlyInterval :` + l + `,` + `on :` + `[{` + `days : ` + n + `}]` + `}`);

                                
                            } else if (foundUser.events[i].rrule.freq === 'yearly') {
                                let l = 1;
                                let d = new Date( foundUser.events[i].start );
                                let n = d.getDate();
                                let m = d.getMonth();
                                let k = m+1;
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + nextDay + `"` + `,` + `yearlyInterval :` + l + `,` + `on :` + `[{` + `months : ` + k + `,` + `days : ` + n + `}` + `]` + `}`);

                            } else {
                                vmisc.push(`{` + `start: ` + `"` + foundUser.events[i].start + `"` + `,` + `end :` + `"` + foundUser.events[i].start + `"`+ `}`);
                            }

                        }

                    }
                    let calendarList;
                    let event;
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
                            container.url= props.htmlLink;
                            let finald;

                            container.textColor=props.id;
                            container.borderColor=Cid;

                         
                            if(props.start !== undefined){
                                if(props.start.dateTime === undefined)
                                {
                                    if(props.start.date[19]==='+'){
                                        finald = props.start.date.substring(0,19)
                                    }
                                    else
                                    {
                                        finald = props.start.date
                                    }
                                    container.start= props.start.date;
                                    container.time = '08:00';
                                    container.allDay= 'true';
  
                                }
                                else{
                                    if(props.start.dateTime[19]==='+'){
                                        finald = props.start.dateTime.substring(0,19)
                                    }
                                    else
                                    {
                                        finald = props.start.dateTime
                                    }
                                    container.start= props.start.dateTime;
                                    container.duration= '01:00';
                                    container.time= props.start.dateTime;
                                    container.allDay= false;
                                }
                            }
                            else if(props.orignalStartTime !== undefined)
                            {
                                if(props.orignalStartTime.dateTime === undefined)
                                {
                                    if(props.orignalStartTime.date[19]==='+'){
                                        finald = props.orignalStartTime.date.substring(0,19)
                                    }
                                    else
                                    {
                                        finald = props.orignalStartTime.date
                                    }
                                    container.start= props.orignalStartTime.date;
                                    container.time = '08:00';
                                    container.allDay= 'true';
                                }
                                else{
                                    if(props.orignalStartTime.dateTime[19]==='+'){
                                        finald = props.orignalStartTime.dateTime.substring(0,19)
                                    }
                                    else
                                    {
                                        finald = props.orignalStartTime.dateTime
                                    }
                                    container.start= props.orignalStartTime.dateTime;
                                    container.duration= '01:00';
                                    container.time= props.orignalStartTime.dateTime;
                                    container.allDay= 'false';
                                }
                            }

                            let count = 0
                            if(props.recurrence!== undefined){
                            for(let k = 11; k<1000; k++)
                            {
                                if(props.recurrence[0][k]==='L')
                                {
                                    count = k;
                                    break;
                                }    
                            }
                            let endDate ;
                            for(let i = 0; i<props.recurrence[0].length; i++){
                                if(props.recurrence[0][i]==='T'&&props.recurrence[0][i+1]==='I'&&props.recurrence[0][i+2]==='L')
                                {
                                    endDate = props.recurrence[0].substring(i+4, i+8)+'-'+props.recurrence[0].substring(i+8, i+10)+'-'+props.recurrence[0].substring(i+10, i+15)+':'+props.recurrence[0].substring(i+15, i+17)+':'+props.recurrence[0].substring(i+17, i+19)+'.000Z';
                                    break;
                                }
                            }
                            if(endDate!==undefined){
                                let s = props.recurrence[0].substring(11, count+2);
                                let freq = s.toLowerCase();
                                let bleh = endDate;
                                
                                container.rrule = {
                                    dtstart : finald,
                                    freq : freq,
                                    until : bleh,
    
                                }

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

app.post("/calendar", function(req, res) {
    const title = req.body.title;
    const time = req.body.time;
    const date = req.body.date+'T'+time+':00';
    const link = req.body.link;
    const id = new Date;
    let dtstart;
    let freq;
    let until;
    const description = req.body.description ;
    const repeat = req.body.repeat;
    if (req.body.repeat !== "none") {
        var day=new Date(req.body.until);
        var nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        dtstart = date;
        freq = req.body.repeat;
        until = nextDay.toISOString();
        
    };
    
    let ndate1 = new Date(date+'.000+05:30');
    let ndate = ndate1.toISOString();
    console.log(ndate);
    
    const event = new Event({
        title: title,
        start: date,
        textColor: ndate,
        time: time,
        url: link,
        _id: id,
        id: id,
        duration: '01:00',
        allDay: false,
        description: description,
        rrule: {
            dtstart: dtstart,
            freq: freq,
            until: until
        },
  
    })

    // console.log(ndate);

    let min = "";
    let hr = "";
    let mnth = "";

    hr = ndate[11] + ndate[12];
    min = ndate[14] + ndate[15];
    dt = ndate[8] + ndate[9];
    mnth = ndate[5] + ndate[6];

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
        to: req.session.email,
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
    


    User.findOne({ googleId: req.session.new}, function(err, foundUser) {
        foundUser.events.push(event);
        foundUser.save();
        res.redirect("/calendar");
    });


    cron.schedule(min + " " + hr + " " + dt + " " + mnth + " " + '*', function() {

        let mailOptions = {
            from: '"ClockIn India" <clockin.india@gmail.com>',
            to: req.session.email,
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

    console.log(req.body.checkOne);

    if(Number.isInteger(parseInt(idi)))
    {
        res.redirect('/calendar');

        try {
            axios.delete("https://www.googleapis.com/calendar/v3/calendars/"+req.body.checkTwo+"/events/"+req.body.checkOne, {
                headers: {
                    'Authorization': `Bearer ${req.session.accessToken}`
                }
            });
        } catch (err) {
            throw new Error('No calendar list');
        }
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