module.exports = (req, res) => {
  res.json({
    success: true,
    message: 'Minimal handler working',
    timestamp: new Date().toISOString(),
  });
};
