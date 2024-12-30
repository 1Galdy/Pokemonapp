const express = require('express');
const path = require('path');
const fetch = require('node-fetch'); // Assure-toi d'avoir installé node-fetch
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs'); // Assure-toi d'avoir configuré le moteur de vue

const infosApp = [
  {
    type: 'images',
    data: {
      logo: 'image/logo.png',
      openBtnBlue: 'image/openButtonBlue.svg',
      openBtnBlack: 'image/openButtonBlack.svg',
    },
  },
  {
    type: 'texte',
    data: {
      titre: 'Pokédex',
      openBtn: 'Bouton ouvert'
    },
  },
  {
    type: 'lien_API',
    data: {
      All: "https://pokeapi.co/api/v2/pokemon?limit=100",
      Type: "https://pokeapi.co/api/v2/type/",
      byId: "https://pokeapi.co/api/v2/pokemon/"
    }
  }
];

const limit = 100; // Nombre de Pokémon par page

async function apiAllData(offset = 0) {
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`);
      const jsonData = await response.json();
      const pokemonData = await Promise.all(jsonData.results.map(async (pokemon) => {
        const detailsResponse = await fetch(pokemon.url);
        const details = await detailsResponse.json();
        return {
          name: pokemon.name,
          id: details.id,
          image: details.sprites.front_default
        };
      }));
      return { pokemonData, count: jsonData.count };
    } catch (error) {
      console.error('Erreur lors de la récupération des données de l\'API', error);
      throw error;
    }
  }  
  
  async function apiTypeData(type) {
    try {
    //   console.log('Fetching type data for:', type);
      const response = await fetch(infosApp[2].data.Type + type.toLowerCase());
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données de l\'API');
      }
      const jsonData = await response.json();
    //   console.log('Type data:', jsonData);
      const pokemonData = await Promise.all(jsonData.pokemon.map(async (p) => {
        const detailsResponse = await fetch(p.pokemon.url);
        if (!detailsResponse.ok) {
          throw new Error('Erreur lors de la récupération des détails du Pokémon');
        }
        const details = await detailsResponse.json();
        return {
          name: p.pokemon.name,
          id: details.id,
          image: details.sprites.front_default
        };
      }));
    //   console.log('Pokemon data by type:', pokemonData);
      return pokemonData;
    } catch (error) {
      console.error('Erreur lors de la récupération des données de l\'API', error);
      throw error;
    }
  }
     

  async function apiByNameData(name) {
    try {
      const response = await fetch(infosApp[2].data.byId + name);
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données de l\'API');
      }
      const jsonData = await response.json();
      const speciesResponse = await fetch(jsonData.species.url);
      const speciesData = await speciesResponse.json();
      const evolutionResponse = await fetch(speciesData.evolution_chain.url);
      const evolutionData = await evolutionResponse.json();
      return { jsonData, speciesData, evolutionData };
    } catch (error) {
      console.error('Erreur lors de la récupération des données de l\'API', error);
      throw error;
    }
  }    

app.get('/', async (req, res) => {
    let filter = req.query.typeOf;
    let offset = parseInt(req.query.offset) || 0;
    let pokemonData;
    let count;
  
    try {
    //   console.log('Filter:', filter);
      if (!filter || filter === 'all') {
        const result = await apiAllData(offset);
        pokemonData = result.pokemonData;
        count = result.count;
        filter = 'all';
      } else {
        pokemonData = await apiTypeData(filter);
        count = pokemonData.length;
      }
    //   console.log('Pokemon Data:', pokemonData);
      res.render('index.ejs', { infosApp, filter, pokemonData, offset, limit, count });
    } catch (error) {
      console.error('Erreur lors de la récupération des données de l\'API', error);
      res.status(500).render('status/500');
    }
  });    

  app.get('/infos', async (req, res) => {
    const name = req.query.pokemonName;
    let jsonData;
    let speciesData;
    let evolutionData;
  
    try {
      if (name) {
        const result = await apiByNameData(name);
        jsonData = result.jsonData;
        speciesData = result.speciesData;
        evolutionData = result.evolutionData;
      } else {
        jsonData = "Il n'y a pas d'information sur ce pokémon pour le moment, revenez plus tard...";
      }
      res.render('components/infos.ejs', { jsonData, speciesData, evolutionData });
    } catch (error) {
      res.status(500).render('status/500');
    }
  });   

app.get('/error', (req, res) => res.status(404).render('status/404'));

app.listen(port, () => {
  console.log(`Accéder au site via : localhost:${port}`);
});
