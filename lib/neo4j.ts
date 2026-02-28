import neo4j from 'neo4j-driver';

const uri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const user = process.env.NEO4J_USERNAME || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'testing1234';

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));

export default driver;

export async function closeNeo4j() {
    await driver.close();
}
