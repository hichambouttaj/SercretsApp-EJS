require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
// const bcrypt = require("bcrypt");
// const saltRounds = 10;
// const md5 = require("md5");
// const encrypt = require("mongoose-encryption");

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Our litte secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());


mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

//useing package mongoose-encryption
// userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields: ["password"]});


const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

// passport.serializeUser(User.serializeUser());
// passport.deserializeUser(User.deserializeUser());

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    })
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
    // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
    },
    (accessToken, refreshToken, profile, cb) => {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, (err, user) => {
            return cb(err, user);
        });
    }
));

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/login", (req, res) => {
    if(req.isAuthenticated()){
        res.render("secrets");
    }else{
        res.render("login");
    }
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/secrets", (req, res) => {
    User.find({"secret": {$ne: null}}, (err, foundUsers) => {
        if(err){
            console.log(err);
        }else{
            if(foundUsers){
                res.render("secrets", {usersWithSecrets: foundUsers});
            }
        }
    });
});

app.get("/submit", (req, res) => {
    if(req.isAuthenticated()){
        res.render("submit");
    }else{
        res.redirect("login");
    }
});

app.post("/submit", (req, res) => {
    const submittedSecret = req.body.secret;
    User.findById(req.user._id, (err, foundUser) => {
        if(err){
            console.log(err);
        }else{
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save((err) => {
                    if(!err){
                        res.redirect("/secrets");
                    }
                });
            }
        }
    });
});

app.get("/logout", (req, res) => {
    req.logout(err => {
        if(err){
            console.log(err);
        }else{
            res.redirect("/");
        }
    })
});

app.get("/auth/google",
    passport.authenticate("google", {scope: ["profile"]})
);

app.get("/auth/google/secrets", 
    passport.authenticate("google", { failureRedirect: "/login" }), (req, res) => {
        res.redirect("/secrets");
    }
);

// app.post("/register", (req, res) => {
//     bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
//         const newUser = new User({
//             email: req.body.username,
//             password: hash
//         });
    
//         newUser.save(err => {
//             if(!err){
//                 res.render("secrets");
//             }else{
//                 console.log(err);
//             }
//         });
//     });
// });


// app.post("/login", (req, res) => {
//     const username = req.body.username;
//     const password = req.body.password;

//     User.findOne(
//         {email: username},
//         (err, foundUser) => {
//             if(err){
//                 console.log(err);
//             }else{
//                 // if(foundUser && foundUser.password === password){
//                 //     res.render("secrets");
//                 // }
//                 if(foundUser){
//                     bcrypt.compare(password, foundUser.password, (err, result) => {
//                         if(result === true){
//                             res.render("secrets");
//                         }
//                     });
//                 }
//             }
//         }
//     );
// });


app.post("/register", (req, res) => {

    User.register({username: req.body.username}, req.body.password, (err, user) => {
        if(err){
            console.log(err);
            res.redirect("/register");
        }else{
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            })
        }
    });

});

app.post("/login", (req, res) => {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, err => {
        if(err){
            console.log(err);
        }else{
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            });
        }
    });

});

app.listen(3000, () => {
    console.log("Server started on port 3000.");
})