#!/usr/bin/env node
import { Command } from 'commander'
import { runSpawnPrompts } from './prompts.js'
import { spawnPlayground } from './spawn.js'

const program = new Command()

program
  .name('eva-consciousness')
  .description('Eva Consciousness — AI-native playground spawner')
  .version('0.1.0')

program
  .command('spawn')
  .description('Spawn a new Eva playground')
  .action(async () => {
    const options = await runSpawnPrompts()
    await spawnPlayground(options)
  })

program.parse()
