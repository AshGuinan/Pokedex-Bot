var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var PokemonSchema = new Schema({
  id: {type: Number},
  forms: {type: Object},
  abilities: {type: Array},
  stats: {type: Array},
  name: {type: String},
  weight: {type: Number},
  height: {type: Number},
  moves: {type: Array},
  sprites: {type: Array},
  held_items: {type: Array},
  location_area_encounters: {type: String},
  type: {type: Array},
  user_id: {type: Number}
});

module.exports = mongoose.model("Pokemon", PokemonSchema);