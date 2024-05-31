import Stock from "../models/stock/Stock";
import {PoolClient} from "pg";

class StockDAO {
    /**
     * Writes a Stock object to the database
     * @param pc {PoolClient} A Postgres Client
     * @param {Stock} stock The stock for which to write to the database
     * @returns {Promise<void>} A promise resolving to nothing
     */
    public async createStock(pc: PoolClient, stock: Stock): Promise<void> {
        const keyString = Object.keys(stock).join(", ");
        const valueString = Object.keys(stock).map((_, index) => `$${index + 1}`).join(", ");
        const query = `INSERT INTO stocks (${keyString}) VALUES (${valueString})`;
        const params = Object.values(stock);
        await pc.query(query, params);
    }

    /**
     * Gets a stock corresponding to a specific ticker
     * @param pc {PoolClient} A Postgres Client
     * @param {string} ticker The ticker of the stock for which to get
     * @returns {Promise<Stock | null>} A promise resolving to a Stock if a stock with the ticker exists, otherwise null
     */
    public async getStock(pc: PoolClient, ticker: string): Promise<Stock | null> {
        const query = "SELECT * FROM stocks WHERE ticker = $1";
        const params = [ticker];
        const result = await pc.query(query, params);
        return result.rows[0] || null;
    }

    /**
     * Updates a stock corresponding to a specific ticker
     * @param pc {PoolClient} A Postgres Client
     * @param {string} ticker The ticker of the stock for which to update
     * @param {Partial<Stock>} stock The fields to update in the stock
     * @returns {Promise<void>} A promise resolving to nothing
     */
    public async updateStock(pc: PoolClient, ticker: string, stock: Partial<Stock>): Promise<void> {
        if (Object.keys(stock).length === 0) {
            throw new Error("No fields to update");
        }
        const fields = Object.keys(stock).map((key, index) => `${key} = $${index + 1}`).join(', ');
        const query = `UPDATE stocks SET ${fields} WHERE ticker = $${Object.keys(stock).length + 1}`;
        const params = [...Object.values(stock), ticker];
        await pc.query(query, params);
    }

    /**
     * Deletes a stock corresponding to a specific ticker
     * @param pc {PoolClient} A Postgres Client
     * @param {string} ticker The ticker of the stock for which to delete
     * @returns {Promise<void>} A promise resolving to nothing
     */
    public async deleteStock(pc: PoolClient, ticker: string): Promise<void> {
        const query = "DELETE FROM stocks WHERE ticker = $1";
        const params = [ticker];
        await pc.query(query, params);
    }

    /**
     * Gets a list of all stocks in the database
     * @param pc {PoolClient} A Postgres Client
     * @returns {Promise<Stock[] | null>} A promise resolving to a list of all stocks
     */
    public async getAllStocks(pc: PoolClient): Promise<Stock[]> {
        const query = "SELECT * FROM stocks";
        const result = await pc.query(query);
        return result.rows.length ? result.rows : [];
    }
}

export default StockDAO;
