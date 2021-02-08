
exports.index = async function(req, res) {
  await require('../controllers/controllers').connectDatabase();

  const airports = routesCollection.distinct('src_airport');
  const airlines = routesCollection.distinct('airline');
  const data = await Promise.all([airports, airlines]);


  res.render('../views/index.html', {
    title: 'Airport Management System',
    data: data,
  });
};
