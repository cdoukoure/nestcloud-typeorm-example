import { Module } from '@nestjs/common';
import { BootModule, Boot } from '@nestcloud/boot';
import { ConsulModule } from '@nestcloud/consul';
import { ConfigModule } from '@nestcloud/config';
import { ServiceModule } from '@nestcloud/service';
import { LoadbalanceModule } from '@nestcloud/loadbalance';
import { FeignModule } from '@nestcloud/feign';
import { ScheduleModule } from '@nestcloud/schedule';
import {
  NEST_BOOT,
  NEST_LOADBALANCE,
  NEST_BOOT_PROVIDER,
  NEST_TYPEORM_LOGGER_PROVIDER,
  components,
  repositories,
  NEST_CONSUL,
} from '@nestcloud/common';
import { TypeOrmHealthIndicator, TerminusModule, TerminusModuleOptions } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProxyModule } from '@nestcloud/proxy';

import * as controllers from './controllers';
import * as repos from './repositories';
import * as services from './services';
import * as clients from './clients';
import { LoggerModule, TypeormLogger } from '@nestcloud/logger';

const getTerminusOptions = (db: TypeOrmHealthIndicator): TerminusModuleOptions => ({
  endpoints: [
    {
      url: '/health',
      healthIndicators: [
        async () => db.pingCheck('database', { timeout: 300 }),
      ],
    },
  ],
});

@Module({
  imports: [
    LoggerModule.register(),
    ScheduleModule.register(),
    BootModule.register(__dirname, `bootstrap-${process.env.NODE_ENV || 'development'}.yml`),
    ConsulModule.register({ dependencies: [NEST_BOOT] }),
    ConfigModule.register({ dependencies: [NEST_BOOT, NEST_CONSUL] }),
    ServiceModule.register({ dependencies: [NEST_BOOT] }),
    LoadbalanceModule.register({ dependencies: [NEST_BOOT] }),
    FeignModule.register({ dependencies: [NEST_LOADBALANCE] }),
    ProxyModule.register({ dependencies: [NEST_BOOT] }),
    TerminusModule.forRootAsync({
      inject: [TypeOrmHealthIndicator],
      useFactory: db => getTerminusOptions(db as TypeOrmHealthIndicator),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (config: Boot, logger: TypeormLogger) => ({
        type: 'mysql',
        host: config.get('dataSource.host', 'localhost'),
        port: config.get('dataSource.port', 3306),
        username: config.get('dataSource.username', 'root'),
        password: config.get('dataSource.password', 'my-secret-pw'),
        database: config.get('dataSource.database', 'nestcloud'),
        entities: [__dirname + '/entities/*{.ts,.js}'],
        synchronize: config.get('dataSource.synchronize', false),
        maxQueryExecutionTime: config.get('dataSource.maxQueryExecutionTime', 1000),
        logging: ['error', 'warn'],
        logger,
      }),
      inject: [NEST_BOOT_PROVIDER, NEST_TYPEORM_LOGGER_PROVIDER],
    }),
  ],
  controllers: components(controllers),
  providers: components(repositories(repos), services, clients),
})
export class AppModule {
}
