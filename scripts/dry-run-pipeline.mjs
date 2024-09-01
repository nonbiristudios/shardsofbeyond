import { execSync } from "child_process";

// Simulate the Pipeline without updating external systems (S3, Github, Pages, Kubernetes, ...)

const executeCommand = (command, mayFail = false) => {
    console.log(`Starting to execute "${command}"...`);
    execSync(command, {env: process.env}, (error, stdout, stderr) => {
      if(error && !mayFail) {
          throw new Error(`Exception occured during executing "${command}":
              ${error}`);
      }

      if(stderr) {
          const errorText = `Error occured while executing "${command}":
              ${stderr}`;

          if(!mayFail) {
              throw new Error(errorText);
          } else {
              console.error(errorText);
          }
      } else {
          console.log(`Executed successfully "${command}":
              ${stdout}`);
      }
    });
}

// Apply Environment variables.
executeCommand('node --env-file=.env ./scripts/update-worksheets.mjs');
executeCommand('node --env-file=.env ./scripts/update-workspace.mjs');
executeCommand('cd opentofu');
executeCommand('tofu init');
executeCommand('tofu plan');
executeCommand('cd ..');
executeCommand('node --env-file=.env ./scripts/render-cards.mjs');