//import animeAPI.js
const animeAPI = require('./animeAPI.js');

//function searchAnime + animedetail 
async function test() {
    try {
        const searchResult = await animeAPI.searchAnime('Naruto');
        console.log('Search Result:', searchResult);
        if (searchResult && searchResult.length > 0) {
            const animeId = searchResult[0].animeUrl;
            const animeDetail = await animeAPI.animeDetail(animeId);
            console.log('Anime Detail:', animeDetail);
        } else {
            console.log('No results found for the search query.');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}
test();