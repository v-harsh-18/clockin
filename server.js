const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.route("/")
.get((req,res)=>{
    res.render('home');
})

app.listen(3000, () => {
    console.log('CONNECTION ESTABLISHED ON PORT 3000')
});
