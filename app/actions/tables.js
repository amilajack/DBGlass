import DB from '../db';

import * as types from './actionTypes';
import { stopFetching, internalInitTable } from './currentTable';

export function setCurrentTable(tableName) {
  return {
    type: types.SET_CURRENT_TABLE,
    tableName
  };
}

export function changeTableName(newTableName) {
  return {
    type: types.CHANGE_TABLE_NAME,
    newTableName
  };
}

export function createTable(tableName, i = -1) {
  return dispatch => new Promise((resolve, reject) => {
    // eslint-disable-next-line no-param-reassign
    DB.createTable(tableName)
      .then(
        () => {
          dispatch({
            type: types.CREATE_TABLE,
            tableName
          });
          resolve(tableName);
        },
        (error) => {
          // if tableName is occupied it sends reject with
          // incremented counter to pick new table name
          // recursively
          if (error.search('already exists')) {
            const j = i + 1;
            reject(j);
          }
        }
      );
  });
}

export function dropTable(tableName) {
  return (dispatch) => {
    dispatch({
      type: 'tables/DROP_TABLE'
    });
    DB.dropTable(tableName);
  };
}

export function truncateTable(tableName, restartIdentity) {
  return (dispatch) => {
    dispatch({
      type: 'tables/TRUNCATE_TABLE'
    });
    DB.truncateTable(tableName, restartIdentity);
  };
}

function internalGetTables(dispatch, clear) {
  return new Promise((resolve, reject) => {
    if (clear) {
      dispatch({ type: types.GET_TABLES, tables: [] });
    }
    DB.getTables()
      .then(
        (tables) => {
          if (tables.length) {
            return DB.getTableOid(tables);
          }
          return tables;
        },
        (error) => {
          reject(error);
        }
      )
      .then(
        (tables) => {
          if (tables.length) {
            return DB.getForeignKeys(tables);
          }
          dispatch(stopFetching());
          return tables;
        }
      )
      .then(
        (tables) => {
          dispatch({
            type: types.GET_TABLES,
            tables
          });
          resolve(tables.length ? tables[0].table_name : '');
        }
      );
  });
}

export function getTables(clear = undefined) {
  return dispatch => (internalGetTables(dispatch, clear));
}

export function reloadTables() {
  return (dispatch, getState) => {
    const currentTableState = getState().currentTable;
    const tableName = currentTableState.tableName;
    dispatch({ type: types.CLEAR_TABLES });
    internalGetTables(dispatch)
      .then(
        () => {
          if (tableName) {
            dispatch({
              type: types.SET_CURRENT_TABLE,
              tableName
            });
            const page = currentTableState.page;
            const order = currentTableState.order;
            const filters = currentTableState.filters;
            internalInitTable(dispatch, getState, { tableName, page, order, filters });
          }
        }
      );
  };
}


export function clearTables() {
  return {
    type: types.CLEAR_TABLES
  };
}


export function searchTables(keyword) {
  return {
    type: types.SEARCH_TABLES,
    keyword
  };
}
