var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");

var db = mongoose.connect(process.env.MONGODB_URI);
var Pokemon = require("./models/pokemon");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 8080));

// Server index page
app.get("/", function (req, res) {
  res.send("Deployed!");
});

// Facebook Webhook
// Used for verification
app.get("/webhook", function (req, res) {
  if (req.query["hub.verify_token"] === process.env.TOKEN) {
    console.log("Verified our webhook");
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    console.error("No dice...");
    res.sendStatus(403);
  }
});

// All callbacks for Messenger will be POST-ed here
app.post("/webhook", function (req, res) {
  // Make sure this is a page subscription
  console.log("Hello_World");
  if (req.body.object == "page") {
    // Iterate over each entry
    // There may be multiple entries if batched
    req.body.entry.forEach(function(entry) {
      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.postback) {
          processPostback(event);
        } else if (event.message) {
          processMessage(event);
        }
      });
    });

    res.sendStatus(200);
  } else {
    console.log("Help!");
  }
});

function processPostback(event) {
  var senderId = event.sender.id;
  var payload = event.postback.payload;

  if (payload === "Greeting") {
    // Get user's first name from the User Profile API
    // and include it in the greeting
    request({
      url: "https://graph.facebook.com/v2.6/" + senderId,
      qs: {
        access_token: process.env.PAGE_ACCESS_TOKEN,
        fields: "first_name"
      },
      method: "GET"
    }, function(error, response, body) {
      var greeting = "";
      if (error) {
        console.log("Error getting user's name: " +  error);
      } else {
        var bodyObj = JSON.parse(body);
        name = bodyObj.first_name;
        greeting = "Hi " + name + ". ";
      }
      var message = greeting + "Welcome trainer! How would you like to find a pokemon, such as ID or name?";
      sendMessage(senderId, {text: message});
    });
  } else if (payload === "Correct") {
    sendMessage(senderId, {text: "Awesome! Would you like to find out more? Try 'abilities', 'weight', 'height' or 'type'"});
  } else if (payload === "Incorrect") {
    sendMessage(senderId, {text: "Oops! Looks like the skitty got distracted... Check out our main page to check our available drinks!"});
  } else {
    sendMessage(senderId, {text: "Theres a problem..."})
  }
}


// sends message to user
function sendMessage(recipientId, message) {
  console.log("sending message '"+ JSON.stringify(message) +"' to " + recipientId + " !!!");
  request({
    url: "https://graph.facebook.com/v2.6/me/messages",
    qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
    method: "POST",
    json: {
      recipient: {id: recipientId},
      message: message,
    }
  }, function(error, response, body) {
    if (error) {
      console.log("Error sending message: " + response.error);
    } else {
      console.log("Message was sent.\n response:: " + JSON.stringify(response));
      console.log("error: " + JSON.stringify(error));
      console.log("body: " + JSON.stringify(body));
    }
  });
}

function processMessage(event) {
  if (!event.message.is_echo) {
    var message = event.message;
    var senderId = event.sender.id;

    console.log("Received message from senderId: " + senderId);
    console.log("Message is: " + JSON.stringify(message));

    // You may get a text or attachment but not both
    if (message.text) {
      var formattedMsg = message.text.toLowerCase().trim();

      // This is where we should be fetching info e.g type, abilities and moves.
      switch (formattedMsg) {
        case "abilities":
        case "weight":
        case "name":
        case "held_items":
        case "type":
        case "height":
          getPokemonInfo(senderId, formattedMsg);
        break;
        case "shiny":
         getPokemonInfo(senderId, formattedMsg, shiny);
        break;
        default:
          findPokemon(senderId, formattedMsg);
      }
    } else if (message.attachments) {
      sendMessage(senderId, {text: "Sorry, I don't understand your request."});
    }
  }
}

function getPokemonInfo(userId, field, shiny) {

  //sendMessage(userId, {text: "Sorry, I don't know any Pokemon like that"});
  Pokemon.findOne({user_id: userId}, function(err, pokemon) {
    if(err) {
      sendMessage(userId, {text: "Hm, looks like the skitty got distracted. Please try again!"});
    } else {
      console.log(pokemon);
      console.log(pokemon[field]);
      var response = pokemon[field];
      if(response instanceof Array){
        response = response.join("\n")
      }
      sendMessage(userId, {text: response});
    }
  });
}

function findPokemon(userId, name) {
  console.log("searching for pokemon" + name)
  request("http://pokeapi.co/api/v2/pokemon/" + name.toLowerCase(), function (error, response, body) {
    console.log("PokeAPI response:")
    console.log("error:",error);
    console.log("status:",response.statusCode);
    if (!error && response.statusCode === 200) {
      var pokeObj = JSON.parse(body);
      if (pokeObj) {
        var query = {user_id: userId};
        var type = [];
        console.log("TYPES")
        console.log(pokeObj.types) 
        for(var i in pokeObj.types){
          var t = pokeObj.types[i];
          console.log("t")
          console.log(t)
          if(t.type == undefined){
            continue;
          }
          type.push(t.type.name); 
        }
        console.log("AbilITIES")
        console.log(pokeObj.abilities) 
        var ability = [];
        for(var i in pokeObj.abilities){
          var a = pokeObj.abilities[i];
          console.log("a");
          console.log(a);
          if(a.ability == undefined){
            continue;
          }
          ability.push(a.ability.name); 
        }
        var update = {
          user_id: userId,
          name: pokeObj.name,
          forms: pokeObj.forms,
          abilities: ability,
          stats: "TO DO",
          weight: pokeObj.weight,
          height: pokeObj.height,
          moves: "To do",
          sprites: pokeObj.sprites,
          type: type
        };
        var options = {upsert: true};
        var sprite = null;
        console.log("the sprites were ", pokeObj.sprites)
        var sprites = [];


        for(key in pokeObj.sprites) {
            if(pokeObj.sprites.hasOwnProperty(key)) {
                var value = pokeObj.sprites[key];
                console.log(pokeObj.sprites[name]);
                if(value != null)
                  sprites.push(value)
                //do something with value;
            }
        }
        sprite = sprites[2];
        console.log("selected sprite", sprite);
        var message = {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: [{
                title: pokeObj.name,
                subtitle: "Is this the pokemon you are looking for?",
                image_url: sprite,
                buttons: [{
                  type: "postback",
                  title: "Yes",
                  payload: "Correct"
                }, {
                  type: "postback",
                  title: "No",
                  payload: "Incorrect"
                }]
              }]
            }
          }
        };
        Pokemon.findOneAndUpdate(query, update, options, function(err, mov) {
          if (err) {
            console.log("Database error: " + err);
          } else {
            console.log("sending")
            sendMessage(userId, message);
          }
        });
        sendMessage(userId, message);
      } else {
          console.log("there was an error and the response wasn't true");
          sendMessage(userId, {text: pokeObj.Error});
      }
    } else {
      sendMessage(userId, {text: "Something went wrong. Try again."});
    }
  });
}