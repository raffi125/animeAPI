// AnimeAPI.js

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const { Buffer } = require('buffer');
const deviceUserAgent = require('./userAgent.js');

let BASE_DOMAIN = 'otakudesu.best';
let BASE_URL = `https://${BASE_DOMAIN}`;

 const BASE = {
  domain: BASE_DOMAIN,
  url: BASE_URL,
};

 const fetchLatestDomain = async () => {
  const domainName = await fetch(
    'https://raw.githubusercontent.com/FightFarewellFearless/AniFlix/master/SCRAPE_DOMAIN.txt',
  ).then((res) => res.text());

  if (domainName === '404: Not Found') {
    throw new Error('Domain not found');
  }

  BASE.domain = domainName.trim();
  BASE.url = `https://${BASE.domain}`;
};

/**
 * Helper: bikin URL absolute dan sekaligus memastikan pakai BASE.domain terbaru.
 * Kalau input bukan URL valid, balikin string as-is.
 */
function normalizeUrlToLatestDomain(inputUrl) {
  if (!inputUrl) return inputUrl;

  try {
    // Kalau inputUrl relatif: resolve dari BASE.url
    const u = new URL(inputUrl, BASE.url);
    // Paksa host = BASE.domain (domain terbaru)
    u.host = BASE.domain;
    return u.toString();
  } catch {
    return inputUrl;
  }
}

/**
 * GET ongoing anime list
 */
 const newAnime = async (page = 1, signal) => {
  const response = await axios.get(`${BASE.url}/ongoing-anime/page/${page}`, {
    timeout: 40_000,
    headers: {
      'Accept-Encoding': '*',
      'User-Agent': deviceUserAgent,
    },
    signal,
  });

  const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
  const $ = cheerio.load(html);

  const data = [];
  $('div.venz > ul li').each((_, el) => {
    const scope = $(el).find('div.detpost').first();
    const item = scope.length > 0 ? scope : $(el);

    const streamingLink = normalizeUrlToLatestDomain(item.find('div.thumb > a').attr('href') ?? '');
    const title = item.find('h2.jdlflm').text().trim();
    const episode = item.find('div.epz').text().trim();

    const thumbnailUrl = normalizeUrlToLatestDomain(
      item.find('div.thumbz > img').attr('src') ??
        item.find('div.thumbz > img').attr('data-src') ??
        item.find('img').first().attr('src') ??
        '',
    );

    const releaseDate = item.find('div.newnime').text().trim();
    const releaseDay = item.find('div.epztipe').text().trim();

    if (!title && !streamingLink) return;

    data.push({
      title,
      episode,
      thumbnailUrl,
      streamingLink,
      releaseDate,
      releaseDay,
    });
  });

  return data;
};

/**
 * Search anime by name
 */
 const searchAnime = async (name, signal) => {
  const response = await axios.get(`${BASE.url}/?s=${encodeURIComponent(name)}&post_type=anime`, {
    timeout: 40_000,
    headers: {
      'Accept-Encoding': '*',
      'User-Agent': deviceUserAgent,
    },
    signal,
  });

  const html = typeof response.data === 'string' ? response.data : String(response.data ?? '');
  const $ = cheerio.load(html);

  const result = [];
  $('div.vezone > div.venser > div.venutama > div.page > ul li').each((_, el) => {
    const link = $(el);

    const animeUrl = normalizeUrlToLatestDomain(link.find('h2 > a').attr('href') ?? '');
    const title = link.find('h2 > a').text().trim();
    const rating = link.find('div.set').eq(2).text().replace('Rating : ', '').trim();
    const status = link.find('div.set').eq(1).text().replace('Status : ', '').trim();
    const thumbnailUrl = normalizeUrlToLatestDomain(link.find('img').attr('src') ?? '');

    const genres = [];
    link
      .find('div.set')
      .eq(0)
      .find('a')
      .each((_, g) => {
        genres.push($(g).text().trim());
      });

    result.push({
      title,
      genres,
      status,
      animeUrl,
      thumbnailUrl,
      rating,
    });
  });

  return result;
};

/**
 * animeDetail: fetch halaman detail anime atau episode streaming
 * - kalau halaman detail anime → return object tipe 'animeDetail'
 * - kalau halaman episode streaming → return object tipe 'animeStreaming'
 *
 * Param selectedRes & skipAutoRes dipertahankan agar kompatibel, tapi belum dipakai (seperti TS aslinya).
 */
 const animeDetail = async (
  url,
  selectedRes = /480p|360p/,
  skipAutoRes = false,
  detailOnly = false,
  signal,
) => {
  // pastikan request selalu pakai domain terbaru
  url = normalizeUrlToLatestDomain(url);

  const response = await axios.get(url, {
    timeout: 40_000,
    headers: {
      'Accept-Encoding': '*',
      'User-Agent': deviceUserAgent,
      'Cache-Control': 'no-cache',
    },
    signal,
  });

  const html = response?.data;
  if (html == null) return undefined;

  const $ = cheerio.load(html, { xmlMode: true });
  const isAnimeDetail = $('div.episodelist').length === 3;
  const aniDetail = $('div.venser');

  if (isAnimeDetail) {
    const getSecondTwoDots = (text) => (text.split(':')[1] ?? '').trim();

    const filmStats = aniDetail.find('div.infozin > div.infozingle');
    const title = aniDetail.find('div.jdlrx').text().trim();

    const synopsisParts = [];
    aniDetail
      .find('div.sinopc')
      .find('p')
      .each((_, p) => synopsisParts.push($(p).text().trim()));

    //epsTotal 
    const epsTotal = getSecondTwoDots(filmStats.find('p').eq(6).text());
    const minutesPerEp = getSecondTwoDots(filmStats.find('p').eq(7).text());
    const thumbnailUrl = normalizeUrlToLatestDomain($('div.fotoanime > img').attr('src') ?? '');

    const alternativeTitle = getSecondTwoDots(filmStats.find('p').eq(1).text());
    const rating = getSecondTwoDots(filmStats.find('p').eq(2).text());
    const aired = getSecondTwoDots(filmStats.find('p').eq(8).text());
    const status = getSecondTwoDots(filmStats.find('p').eq(5).text());
    const studio = getSecondTwoDots(filmStats.find('p').eq(9).text());
    const animeType = getSecondTwoDots(filmStats.find('p').eq(4).text());

    const genres = [];
    filmStats
      .find('p')
      .eq(10)
      .find('a')
      .each((_, a) => genres.push($(a).text().trim()));

    const episodelist = $('div.episodelist').eq(1);
    const episodeList = [];

    if (!detailOnly) {
      episodelist.find('ul li').each((_, el) => {
        const link = normalizeUrlToLatestDomain($(el).find('a').attr('href') ?? '');
        const detailTitle = $(el).find('a').text().trim();
        const releaseDate = $(el).find('span').eq(1).text().trim();
        episodeList.push({ title: detailTitle, link, releaseDate });
      });
    }

    return {
      type: 'animeDetail',
      title,
      genres,
      synopsis: synopsisParts.join('\n'),
      detailOnly,
      episodeList,
      epsTotal,
      minutesPerEp,
      thumbnailUrl,
      alternativeTitle,
      rating,
      releaseYear: aired,
      status,
      studio,
      animeType,
    };
  }

  // ===== streaming page =====
  const title = aniDetail.find('h1.posttl').text().trim();

  let streamingLink = await getStreamLink(
    aniDetail.find('div.responsive-embed-stream > iframe').attr('src') ?? undefined,
    signal,
  );

  const downloadLink = normalizeUrlToLatestDomain(
    aniDetail.find('div.responsive-embed > iframe').attr('src') ?? '',
  );

  const thumbnailUrl = normalizeUrlToLatestDomain($('div.cukder > img').attr('src') ?? '');

  const episodeNav = aniDetail.find('div.flir a');
  const episodeData = {
    animeDetail: normalizeUrlToLatestDomain(
      episodeNav
        .filter((_, el) => $(el).text().trim() === 'See All Episodes')
        .attr('href') ?? '',
    ),
  };

  const prev = episodeNav.filter((_, el) => $(el).text().trim() === 'Previous Eps.');
  if (prev.length !== 0) episodeData.previous = normalizeUrlToLatestDomain(prev.attr('href') ?? '');

  const next = episodeNav.filter((_, el) => $(el).text().trim() === 'Next Eps.');
  if (next.length !== 0) episodeData.next = normalizeUrlToLatestDomain(next.attr('href') ?? '');

  // Script parsing (fragile by nature)
  const changeResScript = $('script').eq(16).text();

  const reqNonceAction =
    changeResScript.split('processData:!0,cache:!0,data:{action:"')[1]?.split('"')[0] ?? '';

  const reqResolutionWithNonceAction =
    changeResScript
      .split('processData:!0,cache:!0,data:{...e,nonce:window.__x__nonce,action:"')[1]
      ?.split('"')[0] ?? '';

  const isValidResolution = (el) => {
    const t = $(el).text().trim();
    return t.startsWith('o') || t.includes('desu') || t.includes('pdrain') || t.includes('filedon');
  };

  const mirrorStream = aniDetail.find('div.mirrorstream ul');

  const m360p = mirrorStream
    .filter((_, el) => $(el).hasClass('m360p'))
    .find('a')
    .filter((_, el) => isValidResolution(el));

  const m480p = mirrorStream
    .filter((_, el) => $(el).hasClass('m480p'))
    .find('a')
    .filter((_, el) => isValidResolution(el));

  const m720p = mirrorStream
    .filter((_, el) => $(el).hasClass('m720p'))
    .find('a')
    .filter((_, el) => isValidResolution(el));

  const resolutionRaw = [
    ...m360p.toArray().map((el) => ({
      resolution: `360p ${$(el).text()}`,
      dataContent: $(el).attr('data-content') ?? '',
    })),
    ...m480p.toArray().map((el) => ({
      resolution: `480p ${$(el).text()}`,
      dataContent: $(el).attr('data-content') ?? '',
    })),
    ...m720p.toArray().map((el) => ({
      resolution: `720p ${$(el).text()}`,
      dataContent: $(el).attr('data-content') ?? '',
    })),
  ];

  let resolution = undefined;

  // Auto-pick resolusi pertama kalau streamingLink belum dapet
  if (streamingLink === undefined && resolutionRaw[0] !== undefined) {
    streamingLink = await fetchStreamingResolution(
      resolutionRaw[0].dataContent,
      reqNonceAction,
      reqResolutionWithNonceAction,
      undefined,
      signal,
    );
    resolution = resolutionRaw[0].resolution;
  }

  const returnObj = {
    type: 'animeStreaming',
    title,
    streamingLink, // bisa undefined (nanti fallback embed)
    streamingType: 'raw',
    downloadLink,
    resolution,
    resolutionRaw,
    thumbnailUrl,
    episodeData,
    reqNonceAction,
    reqResolutionWithNonceAction,
  };

  // Fallback embed kalau raw gagal
  if (returnObj.streamingLink === undefined) {
    returnObj.streamingLink = normalizeUrlToLatestDomain(
      aniDetail.find('div.responsive-embed-stream > iframe').attr('src') ?? '',
    );
    returnObj.streamingType = 'embed';
  }

  return returnObj;
};

 const getStreamLink = async (downLink, signal) => {
  if (downLink === undefined) {
    throw new Error(
      'Gagal mendapatkan link streaming, kemungkinan ini adalah anime dari history lama. ' +
        'Silahkan cari melalui pencarian dan pilih episode yang sesuai.',
    );
  }

  if (downLink.includes('desustream') || downLink.includes('desudrive')) {
    const response = await axios.get(downLink, {
      timeout: 40_000,
      headers: { 'User-Agent': deviceUserAgent },
      signal,
    });

    const data = response.data;

    // desudrive patch ~19-dec-2024
    if (typeof data === 'string' && data.includes(`otakudesu('{"file":"`)) {
      return data.split(`otakudesu('{"file":"`)[1]?.split('"')[0];
    }

    const ondesuORupdesu = typeof data === 'string' ? data.split("sources: [{'file':'")[1] : undefined;

    if (ondesuORupdesu === undefined) {
      if (typeof data === 'string' && data.includes('{id:"playerjs", file:"')) {
        // odstream
        return data.split('{id:"playerjs", file:"')[1]?.split('"')[0];
      }

      if (typeof data === 'string' && data.includes('blogger.com/video.g') && data.includes('iframe')) {
        const iframeSrc = cheerio.load(data)('iframe').attr('src') ?? '';
        return await getBloggerVideo(iframeSrc);
      }

      if (typeof data === 'string' && data.includes('source src=')) {
        return cheerio.load(data)('source').attr('src');
      }

      throw new Error(
        'Gagal mendapatkan link streaming: tidak ada pola data yang cocok. ' +
          'Jika berlanjut, lapor developer (discord/github) agar cepat diperbaiki.',
      );
    }

    return ondesuORupdesu.split("',")[0];
  }

  if (downLink.includes('pixeldrain')) {
    const response = await axios.get(downLink, {
      timeout: 40_000,
      headers: { 'User-Agent': deviceUserAgent },
      signal,
    });
    const $ = cheerio.load(response.data);
    return $('meta[property="og:video:secure_url"]').attr('content');
  }

  if (downLink.includes('filedon')) {
    return await getFiledonVideo(downLink);
  }

  return undefined;
};

 async function getFiledonVideo(url) {
  const response = await axios.get(url, {
    headers: { 'User-Agent': deviceUserAgent },
  });

  const $ = cheerio.load(response.data);

  const convertToValidJson = (jsonString) => {
    let sanitized = String(jsonString ?? '')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");

    if (!sanitized.startsWith('{')) sanitized = `{${sanitized}`;
    if (!sanitized.endsWith('}')) sanitized = `${sanitized}}`;

    try {
      return JSON.parse(sanitized);
    } catch (e) {
      console.error('Failed to parse JSON string:', e);
      throw new Error('Invalid JSON structure after sanitization.');
    }
  };

  const link = convertToValidJson($('div#app').attr('data-page'));
  return link?.props?.url;
}

 async function getBloggerVideo(url) {
  const response = await axios.get(url, {
    headers: { 'User-Agent': deviceUserAgent },
  });

  const html = String(response.data ?? '');
  return html.split('"streams":[{"play_url":"')[1]?.split('"')[0];
}

/**
 * List anime (tanpa worklets). Parsing dilakukan di JS biasa.
 * streamingCallback dipanggil tiap kelipatan 150 item (opsional).
 */
 const listAnime = async (signal, streamingCallback) => {
  const url = `${BASE.url}/anime-list/`;

  const response = await axios.get(url, {
    timeout: 40_000,
    headers: { 'User-Agent': deviceUserAgent },
    signal,
  });

  const html = String(response.data ?? '');

  const removeHtmlTags = (str) => String(str ?? '').replace(/<[^>]*>?/gm, '');

  const listAnimeData = [];
  const divRegex = /<div class="jdlbar">(.*?)<\/div>/g;

  let divMatch;
  while ((divMatch = divRegex.exec(html)) !== null) {
    const divContent = divMatch[1];
    const anchorRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/;
    const anchorMatch = anchorRegex.exec(divContent);

    if (!anchorMatch) continue;

    const href = normalizeUrlToLatestDomain(anchorMatch[1] ?? '');
    const title = removeHtmlTags(anchorMatch[2] ?? '').trim();

    listAnimeData.push({ title, streamingLink: href });

    if (typeof streamingCallback === 'function' && listAnimeData.length % 150 === 0) {
      // callback incremental
      streamingCallback(listAnimeData);
    }
  }

  return listAnimeData;
};

/**
 * Fetch streaming resolution via wp-admin/admin-ajax.php + nonce
 */
 async function fetchStreamingResolution(
  requestData,
  reqNonceAction,
  reqResolutionWithNonceAction,
  nonce,
  signal,
) {
  const requestOptions = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: '*/*',
      'X-Requested-With': 'XMLHttpRequest',
    },
    timeout: 40_000,
    signal,
  };

  // Ambil nonce dulu kalau belum ada
  if (!nonce) {
    const nonceResp = await axios.post(
      `${BASE.url}/wp-admin/admin-ajax.php`,
      { action: reqNonceAction },
      requestOptions,
    );

    const nonceValue = nonceResp?.data?.data;
    if (nonceValue === undefined) return undefined;

    return fetchStreamingResolution(
      requestData,
      reqNonceAction,
      reqResolutionWithNonceAction,
      nonceValue,
      signal,
    );
  }

  // requestData datang base64 JSON string
  const decodedObj = JSON.parse(Buffer.from(String(requestData), 'base64').toString('utf8'));

  const resp = await axios.post(
    `${BASE.url}/wp-admin/admin-ajax.php`,
    {
      ...decodedObj,
      action: reqResolutionWithNonceAction,
      nonce,
    },
    requestOptions,
  );

  const dataBase64 = resp?.data?.data;
  if (!dataBase64) return undefined;

  const iframeSrc = cheerio.load(Buffer.from(String(dataBase64), 'base64').toString('utf8'))(
    'div > iframe',
  ).attr('src');

  return getStreamLink(iframeSrc ?? undefined, signal);
}

/**
 * Jadwal rilis anime
 */
 async function jadwalAnime(signal) {
  const response = await axios.get(`${BASE.url}/jadwal-rilis/`, {
    headers: { 'User-Agent': deviceUserAgent },
    timeout: 40_000,
    signal,
  });

  const html = String(response.data ?? '');
  const $ = cheerio.load(html);

  const list = $('div.kglist321');
  const jadwal = {};

  list.each((_, el) => {
    const $$ = $(el);
    const arr = [];

    $$.find('ul li > a').each((_, a) => {
      arr.push({
        title: $(a).text().trim(),
        link: normalizeUrlToLatestDomain($(a).attr('href') ?? ''),
      });
    });

    jadwal[$$.find('h2').text().trim()] = arr;
        });

    return jadwal;
}

    module.exports ={
    BASE,
    fetchLatestDomain,
    newAnime,
    searchAnime,
    animeDetail,
    listAnime,
    fetchStreamingResolution,
    jadwalAnime,
    getBloggerVideo,
    getFiledonVideo,
    getStreamLink
};
