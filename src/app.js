var express = require('express');
var flock = require('flockos');
var http = require('http');
var config = require('./config');
var bodyParser = require("body-parser");
var mongodb = require('mongodb');
var request = require('request');
var app = express();
var qs = require('querystring');
var MongoClient = mongodb.MongoClient;

//Setting app id and details from config.js
flock.setAppId(config.appId);
flock.setAppSecret(config.appSecret);

app.use(bodyParser.json());
//Verify user tokens
app.use(flock.events.tokenVerifier);

//setting relative path for Event listener
app.post('/events', flock.events.listener);


var tokens;
try {
    tokens = require('./tokens.json');
    var token = tokens[event.token];
} catch (e) {
    tokens = {};
}
//manipulating app.install event
flock.events.on('app.install', function(event) {
    MongoClient.connect(config.dburl, function(err, db) {
        if (err) {
            console.log('Unable to connect to the mongoDB server. Error:', err);
        } else {
            console.log('Connection established to', config.dburl);
            var collection = db.collection('users');
            collection.insert({
                "userId": event.userId,
                "token": event.token
            }, function(err, doc) {
                if (err) throw err;
                console.log(event);
            });
        }
    });

    //Local persist - temp
    tokens[event.userId] = event.userId;
    tokens[event.token] = event.token

});

//remove user id from db on unistall
flock.events.on('app.uninstall', function(event) {
    MongoClient.connect(config.dburl, function(err, db) {
        if (err) {
            console.log('Unable to connect to the mongoDB server. Error:', err);
        } else {
            console.log('Connection established to', config.dburl);
            var collection = db.collection('users');
            collection.remove({
                "userId": event.userId
            }, function(err, doc) {
                if (err) throw err;
                console.log(event);
            });
        }
    });

    //Local del
    delete tokens[event.userId];
    delete tokens[event.token];



});


flock.events.on('client.slashCommand', function(event) {

    var tok = "a6de9d0d-2932-4c22-9e2e-52eaddaf6c75";
    flock.groups.list(tok, null, function(error, response) {
        if (error) {
            console.log('error: ', error);
        } else {
            console.log(response);
        }
    });

    var uri = 'https://newsapi.org/v1/articles' + '?' + qs.stringify({ source: "the-hindu", apiKey: "13228478c1034a9db6cca38e772ea590" })
    options = {};
    request.get(uri, options, function(err, res, body) {
        if (err) {
            return {
                text: "Could'nt fetch the news. Try Again Later."
            }
        }

        var body = JSON.parse(body);
        var articles = body.articles;

        for (var i = 0; i < articles.length; i++) {
            //TODO: handle err
            flock.callMethod('chat.sendMessage', tok, {
                    to: event.chat,
                    "text": "",
                    "attachments": [{
                        "title": articles[i].title,
                        "description": articles[i].description,
                        "views": {
                            "image": {
                                "original": {
                                    "src": articles[i].urlToImage
                                }
                            }
                        },
                        "url": articles[i].url


                    }]
                },
                function(error, response) {
                    if (!error) {
                        console.log(response);
                    }
                });
        }


    });




    return {
        text: "Loading Articles For Today's Feed!"
    }


});

//this starts the listening on the particular port
app.listen(config.port, function() {
    console.log('DailyFeed listening on ' + config.port);
});

process.on('SIGINT', process.exit);
process.on('SIGTERM', process.exit);
process.on('exit', function() {
    fs.writeFileSync('./tokens.json', JSON.stringify(tokens));
});
