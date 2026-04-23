// Loads real setup data from the cc-doctor local server.
// Exposes window.__DATA__ in the same shape the prototype used,
// then fires window.__onDataReady (bootstrapped from index.html).

(function () {
  const signalReady = () => {
    window.__DATA_READY__ = true;
    if (typeof window.__onDataReady === 'function') window.__onDataReady();
  };
  const signalError = (err) => {
    if (typeof window.__onDataError === 'function') window.__onDataError(err);
    else console.error(err);
  };

  fetch('/api/data', { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error('API returned ' + r.status);
      return r.json();
    })
    .then((data) => {
      // The server returns today as an ISO string — rehydrate to a Date
      // so downstream code that calls getDate() keeps working.
      if (typeof data.today === 'string') data.today = new Date(data.today);
      window.__DATA__ = data;
      signalReady();
    })
    .catch((err) => signalError(err));
})();
