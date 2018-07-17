import logger from '../util/logger'
import { IBladeConnectResult, INode, IChannel } from '../interfaces'
import { NETCAST_SUBCOMMAND } from '../util/constants'

interface LocalProtocol {
  name: string
  default_rpc_execute_access?: number
  default_channel_broadcast_access?: number
  default_channel_subscribe_access?: number
  channels: IChannel[]
}

export default class NodeStore {
  nodes: { [k: string]: INode } = {}
  protocols: { [k: string]: LocalProtocol } = {}
  subscriptions: string[] = []
  authorities: string[] = []

  /**
  * Object to map each node with his protocols.
  */
  private nodeXProtocols: { [k: string]: string[] } = {}

  /**
  * Object to map each protocol with each node that support it.
  */
  private protocolXNodes: { [k: string]: string[] } = {}

  constructor(data: IBladeConnectResult) {
    const { routes, protocols, subscriptions, authorities } = data.result
    if (routes) {
      for (let i = 0; i < routes.length; i++) {
        this.nodes[routes[i].nodeid] = routes[i]
      }
    }
    if (protocols) {
      for (let i = 0; i < protocols.length; i++) {
        let protocol = protocols[i]
        let { providers, name } = protocol
        for (let y = 0; y < providers.length; y++) {
          this._addRelation(name, providers[y].nodeid, 'protocolXNodes')
        }
        delete protocol.providers
        this.protocols[name] = protocol
      }
    }
    if (subscriptions) { // TODO:
      // for (let i = 0; i < subscriptions.length; i++) {
      //   this.subscriptions[subscriptions[i].nodeid] = subscriptions[i]
      // }
    }
    if (authorities) { // TODO: check authorities response from Blade
      // for (let i = 0; i < authorities.length; i++) {
      //   let { nodeid } = authorities[i]
      //   this.nodes[nodeid].authority = true
      // }
    }

    this._printStats()
  }

  netcastUpdate(params: any) { // TODO: specify params type
    // logger.info('NET UPDATE: %s', params.command, params)
    const { params: subParams }: any = params // TODO: specify params type
    switch (params.command) {
      case NETCAST_SUBCOMMAND.ROUTE_ADD:
        this._nodeAdd(subParams)
        break
      case NETCAST_SUBCOMMAND.ROUTE_REMOVE:
        this._nodeRemove(subParams.nodeid)
        break
      // case NETCAST_SUBCOMMAND.AUTHORITY_ADD: // TODO
      // break
      // case NETCAST_SUBCOMMAND.AUTHENTICATION_ADD: // TODO
      // break
      case NETCAST_SUBCOMMAND.PROTOCOL_PROVIDER_ADD:
        this._protocolProviderAdd(subParams)
        break
      case NETCAST_SUBCOMMAND.PROTOCOL_PROVIDER_REMOVE:
        this._protocolProviderRemove(subParams)
        break
      default:
        logger.error("Unknow command %s. What should i do?", params.command)
    }

    this._printStats()
  }

  /**
  * Add or Update a Node into 'nodes'
  * @param node INode type
  */
  private _nodeAdd(node: INode): void {
    let { nodeid } = node
    if (this.nodes.hasOwnProperty(nodeid)) {
      this.nodes[nodeid] = { ...this.nodes[nodeid], ...node }
    } else {
      this.nodes[nodeid] = { nodeid }
    }
  }

  /**
  * Remove nodeid from relation objects and real
  * @param nodeid Id of the node to remove
  */
  private _nodeRemove(nodeid: string): void {
    if (this.nodeXProtocols.hasOwnProperty(nodeid)) {
      let protocols = this.nodeXProtocols[nodeid]
      for (let i = 0; i < protocols.length; i++) {
        this._removeRelation(protocols[i], nodeid, 'protocolXNodes')
      }
      delete this.nodeXProtocols[nodeid]
    }
    if (this.nodes.hasOwnProperty(nodeid)) {
      delete this.nodes[nodeid]
    }
  }

  /**
  * Cache the node if it's not cached yet.
  * Cache the protocol into 'protocols' and then add both 1:N relations
  * @param subParams Params from blade.netcast
  */
  private _protocolProviderAdd(subParams: any): void {
    let { nodeid, protocol } = subParams
    if (!this.nodes.hasOwnProperty(nodeid)) { // If i dont know this node, cache it
      this._nodeAdd({ nodeid })
    }
    if (this.protocols.hasOwnProperty(protocol)) {
      this.protocols[protocol].name = protocol
      this.protocols[protocol].channels = [...new Set([...this.protocols[protocol].channels, ...subParams.channels])]
    } else { // Its a new one
      this.protocols[protocol] = {
        name: protocol,
        channels: subParams.channels
      }
    }
    this._addRelation(nodeid, protocol, 'nodeXProtocols')
    this._addRelation(protocol, nodeid, 'protocolXNodes')
  }

  private _protocolProviderRemove(subParams: any): void {
    let { nodeid, protocol } = subParams
    this._removeRelation(nodeid, protocol, 'nodeXProtocols')
    this._removeRelation(protocol, nodeid, 'protocolXNodes')
  }

  /**
  * Add a relation into hash 'nodeXProtocols' | 'protocolXNodes'
  * @param key Node/Protocol key
  * @param value Value to search into has_many relation
  * @param rel Local variable to work on. Only: 'nodeXProtocols' | 'protocolXNodes'
  */
  private _addRelation(key: string, value: string, rel: 'nodeXProtocols' | 'protocolXNodes') {
    if (!this[rel].hasOwnProperty(key)) {
      this[rel][key] = []
    }
    this[rel][key].push(value)
  }

  /**
  * Remove a relation into hash 'nodeXProtocols' | 'protocolXNodes'
  * @param key Node/Protocol key
  * @param value Value to search into has_many relation
  * @param rel Local variable to work on. Only: 'nodeXProtocols' | 'protocolXNodes'
  */
  private _removeRelation(key: string, value: string, rel: 'nodeXProtocols' | 'protocolXNodes'): void {
    if (this[rel].hasOwnProperty(key)) {
      this[rel][key] = this[rel][key].filter(t => t !== value)
    }
  }

  /* Print in console cached data */
  private _printStats() {
    let stats: any = {
      nodes: this.nodes,
      protocols: this.protocols,
      subscriptions: this.subscriptions,
      authorities: this.authorities,
      nodeXProtocols: this.nodeXProtocols,
      protocolXNodes: this.protocolXNodes
    }
    // logger.info(':::NodeStore Stats:::', JSON.stringify(stats))
  }
}