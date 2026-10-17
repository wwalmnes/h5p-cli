import { Command } from 'commander';

export type H5PPlugin = {
  name: string;
  commands?(): Command[];
};
