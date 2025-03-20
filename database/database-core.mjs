/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

function clean(element) {
  if (!element) return element;
  const { createdAt, updatedAt, ...result } = element;
  return result;
}

/**
 * adds an element to a collection (NeDB datastore)
 * @param {object} datastore - the collection
 * @param {object} data - the element to add to the collection
 */
export function addElement(datastore, data) {
  return new Promise(function (resolve, reject) {
    datastore.loadDatabase(function (err) {
      if (err) {
        return reject(err);
      }
      datastore.insert(data, function (err, element) {
        if (err) {
          return reject(err);
        }
        return resolve(clean(element));
      });
    });
  });
}

/**
 * update an element from a collection (NeDB datastore)
 * @param {object} datastore - the collection
 * @param {object} query - the query to retrieve the element (single one)
 * @param {object} data - the data to update
 */
export function updateElement(datastore, query, data) {
  return new Promise(function (resolve, reject) {
    datastore.loadDatabase(function (err) {
      if (err) {
        return reject(err);
      }
      datastore.update(
        query,
        data,
        { returnUpdatedDocs: true },
        function (err, num, element) {
          if (err) {
            return reject(err);
          }
          return resolve(clean(element));
        },
      );
    });
  });
}

/**
 * update elements from a collection (NeDB datastore)
 * @param {object} datastore - the collection
 * @param {object} query - the query to retrieve the elements (multiple)
 * @param {object} data - the data to update
 */
export function updateElements(datastore, query, data) {
  return new Promise(function (resolve, reject) {
    datastore.loadDatabase(function (err) {
      if (err) {
        return reject(err);
      }
      datastore.update(
        query,
        data,
        { multi: true, returnUpdatedDocs: true },
        function (err, num, elements) {
          if (err) {
            return reject(err);
          }
          return resolve(elements.map(clean));
        },
      );
    });
  });
}

/**
 * retrieve an element from a collection (NeDB datastore)
 * @param {object} datastore - the collection
 * @param {object} query - the query to retrieve the element (single one)
 */
export function getElement(datastore, query) {
  return new Promise(function (resolve, reject) {
    datastore.loadDatabase(function (err) {
      if (err) {
        return reject(err);
      }
      datastore.findOne(query, function (err, element) {
        if (err) {
          return reject(err);
        }
        return resolve(clean(element));
      });
    });
  });
}

/**
 * retrieve elements from a collection (NeDB datastore)
 * @param {object} datastore - the collection
 * @param {object} query - the query to retrieve the elements (multiple)
 * @param {number} page - the page index
 * @param {numbers} limit - the number of elements per page
 * @param {object} sort - either starting from the oldest one inserted (sort=1) or the latest one inserted (sort=-1)
 */
export function getElements(datastore, query, page, limit, sort) {
  return new Promise(function (resolve, reject) {
    datastore.loadDatabase(function (err) {
      if (err) {
        return reject(err);
      }
      datastore
        .find(query)
        .sort({ createdAt: sort })
        .skip(page * limit)
        .limit(limit)
        .exec(function (err, elements) {
          if (err) {
            return reject(err);
          }
          return resolve(elements.map(clean));
        });
    });
  });
}
