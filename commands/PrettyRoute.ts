import { BaseCommand, flags } from '@adonisjs/core/build/standalone'
import type { RouterContract } from '@ioc:Adonis/Core/Route'

/**
 * node ace list:routes but pretty
 */
export default class PrettyRoutes extends BaseCommand {
  public static commandName = 'routes:pretty-list'
  public static description = ''

  public static settings = {
    loadApp: true,
    stayAlive: false,
  }

  @flags.boolean({ alias: 'f', name: 'verbose', description: 'Display more information' })
  public verbose: boolean = false

  @flags.boolean({ alias: 'r', name: 'reverse', description: 'Reverse routes display' })
  public reverse: boolean = false

  @flags.boolean({ alias: 'j', name: 'json', description: 'Output to JSNO' })
  public json: boolean = false

  @flags.string({ alias: 'm', name: 'method', description: 'Filter routes by method' })
  public methodFilter: string

  @flags.string({ alias: 'p', name: 'path', description: 'Filter routes by path' })
  public pathFilter: string

  @flags.string({ alias: 'n', name: 'name', description: 'Filter routes by name' })
  public nameFilter: string

  /**
   * The colors associated with each HTTP method
   */
  protected methodColors = {
    ANY: this.colors.red.bind(this.colors),
    GET: this.colors.blue.bind(this.colors),
    HEAD: this.colors.white.bind(this.colors),
    OPTIONS: this.colors.white.bind(this.colors),
    POST: this.colors.yellow.bind(this.colors),
    PUT: this.colors.yellow.bind(this.colors),
    PATCH: this.colors.yellow.bind(this.colors),
    DELETE: this.colors.red.bind(this.colors),
  }

  public async run() {
    const Router = this.application.container.use('Adonis/Core/Route')

    /**
     * Commit routes before we can read them
     */
    Router.commit()

    if (this.json) {
      this.log(JSON.stringify(this.routerToJson(Router), null, 2))
    } else {
      this.outputList(Router)
    }
  }

  private getTerminalWidth() {
    return process.stdout.columns || 80
  }

  private outputList(router: RouterContract) {
    /**
     * Let's flatten routes splitted in different domains
     * in one single array with domain along each route
     */
    let routes = Object.entries(this.routerToJson(router))
      .map(([domain, domainRoutes]) =>
        domainRoutes.map((route) => ({
          ...route,
          domain,
        }))
      )
      .flat()

    const termWidth = this.getTerminalWidth()

    if (this.reverse) routes = routes.reverse()
    if (this.methodFilter) {
      routes = routes.filter((route) => route.methods.includes(this.methodFilter.toUpperCase()))
    }

    const maxMethodsLength = Math.max(...routes.map((route) => route.methods.join('|').length)) - 1

    routes.forEach((route) => {
      const methods = route.methods.join('|')
      const pattern = route.domain !== 'root' ? `${route.domain}${route.pattern}` : route.pattern
      let nameAndHandler = route.name ? ` ${route.name} ⇒ ${route.handler}` : ` ${route.handler}`

      /**
       * Spaces needed to align the start of route patterns
       */
      const spaces = ' '.repeat(Math.max(maxMethodsLength + 5 - methods.length, 0))

      /**
       * If name and handler output is too long we crop it
       */
      const totalLength = (methods + spaces + pattern + ' ' + nameAndHandler).length
      if (totalLength > termWidth) {
        const lenWithoutNameAndHandler = (methods + spaces + pattern + ' ').length
        nameAndHandler = nameAndHandler.substring(0, termWidth - lenWithoutNameAndHandler - 1) + '…'
      }

      /**
       * How many dots we need to align the handlers
       */
      const dots = ' ' + '.'.repeat(Math.max(termWidth - totalLength, 0))

      const middlewares = route.middleware
        .map((middleware) => {
          const startSpace = ' '.repeat(maxMethodsLength + 5)
          return this.colors.grey(`${startSpace}⇂ ${middleware}`)
        })
        .join('\n')

      this.outputRoute(route.methods, spaces, pattern, dots, nameAndHandler, middlewares)
    })
  }

  /**
   * Output route and middlewares by concatenating and colorizing each part of it
   */
  private outputRoute(
    methods: string[],
    spaces: string,
    pattern: string,
    dots: string,
    nameAndHandler: string,
    middlewares: string
  ) {
    const methodsOutput = methods
      .map((method) => this.methodColors[method.toUpperCase()](method))
      .join('|')

    const patternOutput = pattern.replace(/:([^/]+)/gm, `${this.colors.yellow('$&')}`)
    const nameAndHandlerOutput = this.colors.grey(nameAndHandler)
    const dotsOutput = this.colors.grey(dots)

    this.log(methodsOutput + spaces + patternOutput + dotsOutput + nameAndHandlerOutput)

    if (middlewares && this.verbose) {
      this.log(middlewares)
    }
  }

  /**
   * Stolen code from @adonisjs/core/commands/ListRoutes.ts
   */
  private log(message: string) {
    if (this.application.environment === 'test') {
      this.logger.log(message)
    } else {
      console.log(message)
    }
  }

  /**
   * Stolen code from @adonisjs/core/commands/ListRoutes.ts
   */
  private routerToJson(router: RouterContract) {
    const routes = router.toJSON()

    return Object.keys(routes).reduce<{
      [domain: string]: {
        methods: string[]
        name: string
        pattern: string
        handler: string
        middleware: string[]
      }[]
    }>((result, domain) => {
      result[domain] = routes[domain].map((route) => {
        let handler: string = 'Closure'

        const middleware = route
          ? route.middleware.map((one) => (typeof one === 'function' ? 'Closure' : one))
          : []

        if (route.meta.resolvedHandler!.type !== 'function' && route.meta.namespace) {
          handler = `${route.meta.resolvedHandler!['namespace']}.${
            route.meta.resolvedHandler!['method']
          }`
        } else if (route.meta.resolvedHandler!.type !== 'function') {
          const method = route.meta.resolvedHandler!['method']
          const routeHandler = route.handler as string
          handler = `${routeHandler.replace(new RegExp(`.${method}$`), '')}.${method}`
        }

        return {
          methods: route.methods,
          name: route.name || '',
          pattern: route.pattern,
          handler: handler,
          middleware: middleware,
        }
      })

      return result
    }, {})
  }
}
