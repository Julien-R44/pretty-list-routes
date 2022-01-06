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

  @flags.boolean({ alias: 'r', name: 'reverse', description: 'Reverse routes display' })
  public reverse: boolean = false

  @flags.string({ alias: 'm', name: 'method', description: 'Filter routes by method' })
  public methodFilter: string

  @flags.string({ alias: 'p', name: 'path', description: 'Filter routes by path' })
  public pathFilter: string

  @flags.string({ alias: 'n', name: 'name', description: 'Filter routes by name' })
  public nameFilter: string

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

    Router.commit()

    // TODO : add domains

    let routes = this.toJson(Router).root
    const termWidth = this.getTerminalWidth()

    if (this.reverse) routes = routes.reverse()
    if (this.methodFilter) {
      routes = routes.filter((route) => route.methods.includes(this.methodFilter.toUpperCase()))
    }

    const maxMethodsLength = Math.max(...routes.map((route) => route.methods.join('|').length)) - 1
    routes.forEach((route) => {
      const methodsLength = route.methods.join('|').length
      const methodsOutput = route.methods
        .map((method) => this.methodColors[method.toUpperCase()](method))
        .join('|')

      const spaces = ' '.repeat(Math.max(maxMethodsLength + 5 - methodsLength, 0))
      const patternOutput = route.pattern.replace(/\/(:.*?)\//g, `/${this.colors.yellow('$1')}/`)

      const dots = '.'.repeat(
        Math.max(
          termWidth -
            methodsLength -
            spaces.length -
            route.pattern.length -
            route.name.length -
            route.handler.length -
            5,
          0
        )
      )

      console.log(
        methodsOutput +
          spaces +
          patternOutput +
          ` ${this.colors.grey(dots)} ` +
          this.colors.grey(route.name) +
          ' > ' +
          route.handler
      )
    })
  }

  private getTerminalWidth() {
    return process.stdout.columns || 80
  }

  private toJson(router: RouterContract) {
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
