const express = require('express');
const path = require('path');
const fetch = require('node-fetch'); // Compatible avec CommonJS
const serverless = require('serverless-http');

const app = express();
const port = process.env.PORT || 3000;

// Timeout helper
const fetchWithTimeout = async (url, options = {}, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    console.error(`Timeout ou erreur réseau pour : ${url}`);
    throw error;
  }
};

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

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
      All: "https://pokeapi.co/api/v2/pokemon?limit=20",
      Type: "https://pokeapi.co/api/v2/type/",
      byId: "https://pokeapi.co/api/v2/pokemon/"
    }
  }
];

const limit = 20; // Réduit pour éviter surcharge sur Render

async function apiAllData(offset = 0) {
  try {
    const response = await fetchWithTimeout(`${infosApp[2].data.All}&offset=${offset}`);
    const jsonData = await response.json();
    const pokemonData = await Promise.all(jsonData.results.map(async (pokemon) => {
      const detailsResponse = await fetchWithTimeout(pokemon.url);
      const details = await detailsResponse.json();
      return {
        name: pokemon.name,
        id: details.id,
        image: details.sprites.front_default
      };
    }));
    return { pokemonData, count: jsonData.count };
  } catch (error) {
    console.error('Erreur dans apiAllData:', error);
    throw error;
  }
}

async function apiTypeData(type) {
  try {
    const response = await fetchWithTimeout(infosApp[2].data.Type + type.toLowerCase());
    if (!response.ok) throw new Error('Erreur lors de la récupération des données de l\'API');
    const jsonData = await response.json();
    const limitedPokemon = jsonData.pokemon.slice(0, limit); // Limite pour éviter surcharge
    const pokemonData = await Promise.all(limitedPokemon.map(async (p) => {
      const detailsResponse = await fetchWithTimeout(p.pokemon.url);
      const details = await detailsResponse.json();
      return {
        name: p.pokemon.name,
        id: details.id,
        image: details.sprites.front_default
      };
    }));
    return pokemonData;
  } catch (error) {
    console.error('Erreur dans apiTypeData:', error);
    throw error;
  }
}

async function apiByNameData(name) {
  try {
    const response = await fetchWithTimeout(infosApp[2].data.byId + name);
    if (!response.ok) throw new Error('Erreur lors de la récupération des données de l\'API');
    const jsonData = await response.json();
    const speciesResponse = await fetchWithTimeout(jsonData.species.url);
    const speciesData = await speciesResponse.json();
    const evolutionResponse = await fetchWithTimeout(speciesData.evolution_chain.url);
    const evolutionData = await evolutionResponse.json();
    return { jsonData, speciesData, evolutionData };
  } catch (error) {
    console.error('Erreur dans apiByNameData:', error);
    throw error;
  }
}

app.get('/', async (req, res) => {
  let filter = req.query.typeOf;
  let offset = parseInt(req.query.offset) || 0;
  let pokemonData;
  let count;

  try {
    if (!filter || filter === 'all') {
      const result = await apiAllData(offset);
      pokemonData = result.pokemonData;
      count = result.count;
      filter = 'all';
    } else {
      pokemonData = await apiTypeData(filter);
      count = pokemonData.length;
    }
    res.render('index.ejs', { infosApp, filter, pokemonData, offset, limit, count });
  } catch (error) {
    res.status(500).render('status/500');
  }
});

app.get('/infos', async (req, res) => {
  const name = req.query.pokemonName;
  try {
    if (name) {
      const result = await apiByNameData(name);
      res.render('components/infos.ejs', {
        jsonData: result.jsonData,
        speciesData: result.speciesData,
        evolutionData: result.evolutionData
      });
    } else {
      res.render('components/infos.ejs', {
        jsonData: "Aucune info disponible.",
        speciesData: null,
        evolutionData: null
      });
    }
  } catch (error) {
    res.status(500).render('status/500');
  }
});

app.get('/error', (req, res) => res.status(404).render('status/404'));

// Export pour Netlify ou Render
module.exports.handler = serverless(app);

// Pour exécution locale
if (require.main === module) {
  app.listen(port, '0.0.0.0',() => {
    console.log(`Serveur en ligne sur le port ${port}`);
  });
}
