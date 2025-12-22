const neo4j = require('neo4j-driver');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

class Neo4jGraphService {
  constructor() {
    this.driver = null;
    this.session = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.driver = neo4j.driver(
        config.neo4j.uri,
        neo4j.auth.basic(config.neo4j.username, config.neo4j.password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
        }
      );

      // Test connection
      await this.driver.verifyConnectivity();
      this.isConnected = true;
      logger.info('Connected to Neo4j database successfully');

      // Initialize schema
      await this.initializeSchema();
    } catch (error) {
      logger.error('Failed to connect to Neo4j:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async initializeSchema() {
    const session = this.driver.session();
    try {
      // Create constraints and indexes
      await session.run(`
        CREATE CONSTRAINT document_id IF NOT EXISTS 
        FOR (d:Document) REQUIRE d.id IS UNIQUE
      `);

      await session.run(`
        CREATE CONSTRAINT chunk_id IF NOT EXISTS 
        FOR (c:Chunk) REQUIRE c.id IS UNIQUE
      `);

      await session.run(`
        CREATE CONSTRAINT entity_id IF NOT EXISTS 
        FOR (e:Entity) REQUIRE e.id IS UNIQUE
      `);

      await session.run(`
        CREATE INDEX chunk_embedding IF NOT EXISTS 
        FOR (c:Chunk) ON (c.embedding)
      `);

      await session.run(`
        CREATE INDEX entity_type IF NOT EXISTS 
        FOR (e:Entity) ON (e.type)
      `);

      logger.info('Neo4j schema initialized successfully');
    } catch (error) {
      logger.error('Error initializing Neo4j schema:', error);
    } finally {
      await session.close();
    }
  }

  async disconnect() {
    if (this.driver) {
      await this.driver.close();
      this.isConnected = false;
      logger.info('Disconnected from Neo4j database');
    }
  }

  async createDocument(workflowId, documentData) {
    const session = this.driver.session();
    try {
      const documentId = uuidv4();
      const result = await session.run(`
        CREATE (d:Document {
          id: $documentId,
          workflowId: $workflowId,
          filename: $filename,
          content: $content,
          metadata: $metadata,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        RETURN d
      `, {
        documentId,
        workflowId,
        filename: documentData.filename,
        content: documentData.content,
        metadata: JSON.stringify(documentData.metadata || {})
      });

      logger.info(`Created document node: ${documentId}`);
      return documentId;
    } catch (error) {
      logger.error('Error creating document in Neo4j:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
  async createChunksWithEmbeddings(documentId, chunks, embeddings) {
    const session = this.driver.session();
    try {
      const chunkNodes = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkId = uuidv4();
        const chunk = chunks[i];
        const embedding = embeddings[i];

        await session.run(`
          MATCH (d:Document {id: $documentId})
          CREATE (c:Chunk {
            id: $chunkId,
            content: $content,
            embedding: $embedding,
            chunkIndex: $chunkIndex,
            tokenCount: $tokenCount,
            createdAt: datetime()
          })
          CREATE (d)-[:CONTAINS]->(c)
          RETURN c
        `, {
          documentId,
          chunkId,
          content: chunk.content,
          embedding: embedding,
          chunkIndex: i,
          tokenCount: chunk.tokenCount || 0
        });

        chunkNodes.push({ id: chunkId, content: chunk.content, index: i });
      }

      logger.info(`Created ${chunkNodes.length} chunk nodes for document ${documentId}`);
      return chunkNodes;
    } catch (error) {
      logger.error('Error creating chunks in Neo4j:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async extractAndCreateEntities(documentId, content) {
    const session = this.driver.session();
    try {
      // First get the document's workflow ID
      const docResult = await session.run(`
        MATCH (d:Document {id: $documentId})
        RETURN d.workflowId as workflowId
      `, { documentId });
      
      if (docResult.records.length === 0) {
        throw new Error(`Document ${documentId} not found`);
      }
      
      const workflowId = docResult.records[0].get('workflowId');
      
      // Use AI to extract entities (this would integrate with your existing AI services)
      const entities = await this.extractEntitiesWithAI(content);
      const entityNodes = [];

      for (const entity of entities) {
        const entityId = uuidv4();
        
        await session.run(`
          MERGE (e:Entity {name: $name, type: $type, workflowId: $workflowId})
          ON CREATE SET 
            e.id = $entityId,
            e.createdAt = datetime(),
            e.frequency = 1
          ON MATCH SET 
            e.frequency = e.frequency + 1,
            e.updatedAt = datetime()
          WITH e
          MATCH (d:Document {id: $documentId})
          MERGE (d)-[:MENTIONS {confidence: $confidence}]->(e)
          RETURN e
        `, {
          entityId,
          name: entity.name,
          type: entity.type,
          confidence: entity.confidence,
          documentId,
          workflowId
        });

        entityNodes.push(entity);
      }

      logger.info(`Extracted and created ${entityNodes.length} entities for document ${documentId}`);
      return entityNodes;
    } catch (error) {
      logger.error('Error extracting entities in Neo4j:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createEntityRelationships(entities, workflowId) {
    const session = this.driver.session();
    try {
      const relationships = await this.extractRelationshipsWithAI(entities);
      
      for (const rel of relationships) {
        await session.run(`
          MATCH (e1:Entity {name: $entity1, workflowId: $workflowId})
          MATCH (e2:Entity {name: $entity2, workflowId: $workflowId})
          MERGE (e1)-[r:RELATED_TO {
            type: $relationType,
            confidence: $confidence,
            createdAt: datetime(),
            workflowId: $workflowId
          }]->(e2)
          RETURN r
        `, {
          entity1: rel.source,
          entity2: rel.target,
          relationType: rel.type,
          confidence: rel.confidence,
          workflowId
        });
      }

      logger.info(`Created ${relationships.length} entity relationships`);
      return relationships;
    } catch (error) {
      logger.error('Error creating entity relationships:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async hybridSearch(query, workflowId, limit = 10) {
    const session = this.driver.session();
    const intLimit = Math.floor(Number(limit)); // Ensure it's an integer
    
    try {
      // 1. Vector similarity search on chunks
      const vectorResults = await this.vectorSimilaritySearch(query, workflowId, intLimit);
      
      // 2. Graph traversal for related entities
      const graphResults = await session.run(`
        MATCH (d:Document {workflowId: $workflowId})-[:MENTIONS]->(e:Entity)
        WHERE e.name CONTAINS $query OR e.type CONTAINS $query
        MATCH (e)-[:RELATED_TO*1..2]-(related:Entity)
        MATCH (d2:Document)-[:MENTIONS]->(related)
        MATCH (d2)-[:CONTAINS]->(c:Chunk)
        RETURN DISTINCT c.id as chunkId, c.content as content, 
               collect(DISTINCT e.name) as entities,
               collect(DISTINCT related.name) as relatedEntities,
               count(related) as relationshipScore
        ORDER BY relationshipScore DESC
        LIMIT $limit
      `, {
        query: query.toLowerCase(),
        workflowId,
        limit: neo4j.int(intLimit) // Use Neo4j integer type
      });

      // 3. Combine and rank results
      const combinedResults = this.combineSearchResults(vectorResults, graphResults.records);
      
      logger.info(`Hybrid search returned ${combinedResults.length} results`);
      return combinedResults;
    } catch (error) {
      logger.error('Error in hybrid search:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async vectorSimilaritySearch(query, workflowId, limit) {
    // This would integrate with your existing vector service
    // For now, return a placeholder structure
    return [];
  }

  combineSearchResults(vectorResults, graphResults) {
    const combined = [];
    const seen = new Set();

    // Add vector results with vector score
    vectorResults.forEach(result => {
      if (!seen.has(result.chunkId)) {
        combined.push({
          ...result,
          source: 'vector',
          vectorScore: result.score,
          graphScore: 0
        });
        seen.add(result.chunkId);
      }
    });

    // Add graph results with relationship score
    graphResults.forEach(record => {
      const chunkId = record.get('chunkId');
      if (!seen.has(chunkId)) {
        combined.push({
          chunkId,
          content: record.get('content'),
          entities: record.get('entities'),
          relatedEntities: record.get('relatedEntities'),
          source: 'graph',
          vectorScore: 0,
          graphScore: record.get('relationshipScore').toNumber()
        });
        seen.add(chunkId);
      } else {
        // Enhance existing result with graph data
        const existing = combined.find(r => r.chunkId === chunkId);
        if (existing) {
          existing.entities = record.get('entities');
          existing.relatedEntities = record.get('relatedEntities');
          existing.graphScore = record.get('relationshipScore').toNumber();
          existing.source = 'hybrid';
        }
      }
    });

    // Sort by combined score
    return combined.sort((a, b) => {
      const scoreA = (a.vectorScore || 0) * 0.6 + (a.graphScore || 0) * 0.4;
      const scoreB = (b.vectorScore || 0) * 0.6 + (b.graphScore || 0) * 0.4;
      return scoreB - scoreA;
    }).slice(0, 20);
  }

  async extractEntitiesWithAI(content) {
    // Integration with your existing AI services (Bedrock/Gemini)
    const bedrock = require('./bedrock');
    
    // Use more content for better extraction
    const contentToAnalyze = content.substring(0, 8000);
    const prompt = `You are an expert at extracting named entities from RFP documents. Extract ALL important entities from this text.

Text to analyze:
${contentToAnalyze}

Extract entities and return ONLY a valid JSON array in this exact format:
[{"name": "Entity Name", "type": "ORGANIZATION", "confidence": 0.95}]

Entity types must be one of: PERSON, ORGANIZATION, LOCATION, TECHNOLOGY, CONCEPT

Extract COMPREHENSIVE entities including:
- ALL company names, organizations, and government bodies
- ALL technologies, systems, platforms, and tools mentioned
- ALL key concepts, requirements, and methodologies
- ALL important people, roles, and positions
- ALL locations, cities, and places
- ALL standards, regulations, and compliance requirements
- ALL project names and initiatives
- ALL technical terms and domain-specific concepts

Be thorough and extract 15-30 entities. Return only the JSON array, no other text.`;

    try {
      const response = await bedrock.generateContent(prompt);
      logger.info(`Entity extraction AI response: ${response.substring(0, 500)}`);
      
      // Try multiple parsing strategies
      let entities = [];
      
      // Strategy 1: Look for JSON array
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        try {
          entities = JSON.parse(jsonMatch[0]);
          if (Array.isArray(entities) && entities.length > 0) {
            logger.info(`Successfully parsed ${entities.length} entities from AI response`);
            return entities;
          }
        } catch (parseError) {
          logger.warn('Failed to parse JSON array from AI response');
        }
      }
      
      // Strategy 2: Look for individual JSON objects
      const objectMatches = response.match(/\{[^}]*"name"[^}]*\}/g);
      if (objectMatches) {
        entities = [];
        for (const match of objectMatches) {
          try {
            const entity = JSON.parse(match);
            if (entity.name && entity.type) {
              entities.push({
                name: entity.name,
                type: entity.type.toUpperCase(),
                confidence: entity.confidence || 0.8
              });
            }
          } catch (e) {
            // Skip invalid objects
          }
        }
        if (entities.length > 0) {
          logger.info(`Extracted ${entities.length} entities using fallback parsing`);
          return entities;
        }
      }
      
      // Strategy 3: Fallback - extract from text patterns
      logger.warn('AI entity extraction failed, using fallback pattern matching');
      return this.extractEntitiesFallback(contentToAnalyze);
      
    } catch (error) {
      logger.error('Error extracting entities with AI:', error);
      return this.extractEntitiesFallback(contentToAnalyze);
    }
  }

  extractEntitiesFallback(content) {
    const entities = [];
    
    // Enhanced patterns for comprehensive extraction
    const patterns = [
      // Organizations and companies
      { regex: /\b[A-Z][a-z]+ (?:Corporation|Corp|Company|Co|Inc|Ltd|Limited|LLC|Organization|Org|Agency|Department|Ministry|Government|Authority|Commission|Board|Council|Institute|Foundation|Association|Society|Group|Systems|Solutions|Technologies|Services|Consulting|Partners|Holdings)\b/g, type: 'ORGANIZATION' },
      { regex: /\b(?:Government of [A-Z][a-z]+|Ministry of [A-Z][a-z]+|Department of [A-Z][a-z]+)\b/g, type: 'ORGANIZATION' },
      
      // Technologies and systems
      { regex: /\b(?:AWS|Azure|Google Cloud|Microsoft|Oracle|IBM|SAP|Salesforce|ServiceNow|Workday|Adobe|Cisco|VMware|Dell|HP|Intel|NVIDIA|Red Hat|MongoDB|PostgreSQL|MySQL|Docker|Kubernetes|Jenkins|Git|GitHub|GitLab|Jira|Confluence|Slack|Teams|Zoom|Office 365|SharePoint|Exchange|Active Directory)\b/gi, type: 'TECHNOLOGY' },
      { regex: /\b(?:API|REST|SOAP|GraphQL|JSON|XML|HTTP|HTTPS|SSL|TLS|OAuth|SAML|LDAP|SQL|NoSQL|database|server|cloud|platform|system|application|software|hardware|network|infrastructure|framework|library|SDK|IDE|CRM|ERP|CMS|LMS|HRMS|SCM|BI|ETL|AI|ML|IoT|VR|AR|blockchain|microservices|containerization|virtualization|automation|DevOps|CI\/CD)\b/gi, type: 'TECHNOLOGY' },
      
      // Concepts and requirements
      { regex: /\b(?:requirement|specification|compliance|security|performance|scalability|availability|reliability|maintainability|usability|accessibility|interoperability|portability|efficiency|functionality|quality|standard|protocol|methodology|framework|architecture|design|implementation|deployment|testing|validation|verification|monitoring|logging|backup|recovery|disaster recovery|business continuity|risk management|change management|project management|agile|scrum|waterfall|DevOps|ITIL|COBIT|ISO|NIST|GDPR|HIPAA|SOX|PCI DSS)\b/gi, type: 'CONCEPT' },
      
      // Locations
      { regex: /\b(?:[A-Z][a-z]+ (?:City|State|Province|Country|Region|District|County|Municipality|Territory|Republic|Kingdom|Federation|Union|Emirates|Islands))\b/g, type: 'LOCATION' },
      { regex: /\b(?:United States|USA|Canada|United Kingdom|UK|Australia|Germany|France|Italy|Spain|Japan|China|India|Brazil|Mexico|Russia|South Africa|New York|California|Texas|Florida|London|Paris|Tokyo|Sydney|Toronto|Mumbai|Delhi|Bangalore|Singapore|Hong Kong)\b/gi, type: 'LOCATION' },
      
      // People and roles
      { regex: /\b(?:CEO|CTO|CIO|CFO|COO|President|Vice President|VP|Director|Manager|Lead|Senior|Principal|Architect|Engineer|Developer|Analyst|Consultant|Specialist|Administrator|Coordinator|Supervisor|Executive|Officer)\b/gi, type: 'PERSON' },
      
      // Standards and regulations
      { regex: /\b(?:ISO ?\d+|NIST|GDPR|HIPAA|SOX|PCI DSS|FISMA|FedRAMP|SOC \d|SSAE \d+|SAS \d+|COBIT|ITIL|TOGAF|PMBOK|PRINCE2|Six Sigma|Lean|Agile|Scrum|Kanban)\b/gi, type: 'CONCEPT' },
      
      // Project and initiative names
      { regex: /\b[A-Z][A-Z0-9_-]*[A-Z0-9]\b/g, type: 'CONCEPT' },
      
      // Technical terms
      { regex: /\b(?:dashboard|portal|interface|module|component|service|endpoint|middleware|gateway|proxy|load balancer|firewall|router|switch|server|workstation|laptop|desktop|mobile|tablet|smartphone|browser|operating system|OS|Windows|Linux|macOS|Android|iOS)\b/gi, type: 'TECHNOLOGY' }
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern.regex) || [];
      matches.forEach(match => {
        const cleanMatch = match.trim();
        if (cleanMatch.length > 2 && !entities.find(e => e.name.toLowerCase() === cleanMatch.toLowerCase())) {
          entities.push({
            name: cleanMatch,
            type: pattern.type,
            confidence: 0.7
          });
        }
      });
    });
    
    // Also extract quoted terms and proper nouns
    const quotedTerms = content.match(/"([^"]+)"/g) || [];
    quotedTerms.forEach(term => {
      const cleanTerm = term.replace(/"/g, '').trim();
      if (cleanTerm.length > 3 && !entities.find(e => e.name.toLowerCase() === cleanTerm.toLowerCase())) {
        entities.push({
          name: cleanTerm,
          type: 'CONCEPT',
          confidence: 0.6
        });
      }
    });
    
    logger.info(`Fallback extraction found ${entities.length} entities`);
    return entities.slice(0, 25); // Limit to top 25
  }

  async extractRelationshipsWithAI(entities) {
    const bedrock = require('./bedrock');
    
    const entityNames = entities.map(e => e.name).join(', ');
    const prompt = `Identify relationships between these entities: ${entityNames}

Return as JSON array:
[{"source": "entity1", "target": "entity2", "type": "WORKS_WITH|PART_OF|USES|RELATED_TO", "confidence": 0.8}]`;

    try {
      const response = await bedrock.generateContent(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      logger.error('Error extracting relationships with AI:', error);
      return [];
    }
  }

  async getWorkflowGraph(workflowId) {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (d:Document {workflowId: $workflowId})-[:MENTIONS]->(e:Entity)
        OPTIONAL MATCH (e)-[r:RELATED_TO]-(related:Entity)
        RETURN d.filename as document, 
               collect(DISTINCT {
                 name: e.name, 
                 type: e.type, 
                 frequency: e.frequency
               }) as entities,
               collect(DISTINCT {
                 source: e.name,
                 target: related.name,
                 type: type(r),
                 confidence: r.confidence
               }) as relationships
      `, { workflowId });

      return result.records.map(record => ({
        document: record.get('document'),
        entities: record.get('entities').map(entity => ({
          name: entity.name,
          type: entity.type,
          frequency: typeof entity.frequency === 'bigint' ? Number(entity.frequency) : entity.frequency
        })),
        relationships: record.get('relationships').filter(r => r.target !== null).map(rel => ({
          source: rel.source,
          target: rel.target,
          type: rel.type,
          confidence: typeof rel.confidence === 'bigint' ? Number(rel.confidence) : rel.confidence
        }))
      }));
    } catch (error) {
      logger.error('Error getting workflow graph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async deleteWorkflowData(workflowId) {
    const session = this.driver.session();
    try {
      await session.run(`
        MATCH (d:Document {workflowId: $workflowId})
        DETACH DELETE d
      `, { workflowId });
      
      logger.info(`Deleted Neo4j data for workflow: ${workflowId}`);
    } catch (error) {
      logger.error('Error deleting workflow data from Neo4j:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
}

module.exports = new Neo4jGraphService();