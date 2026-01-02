# CI/CD Pipeline Guide

Automate Ralph Orchestrator TypeScript deployment with continuous integration and delivery pipelines.

## Overview

This guide covers setting up automated pipelines for:
- Code testing and validation
- Docker image building and pushing
- Documentation deployment
- Automated releases
- Multi-environment deployments

## GitHub Actions

### Complete CI/CD Workflow

Create `.github/workflows/ci-cd.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # Test Job
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Run type checking
      run: bun run typecheck

    - name: Run linting
      run: bun run lint

    - name: Run tests
      run: bun test --coverage

    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        fail_ci_if_error: true

  # Security Check
  security:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Run security audit
      run: bun audit

    - name: Scan for vulnerabilities
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        ignore-unfixed: true
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      with:
        sarif_file: 'trivy-results.sarif'

  # Build Docker Image
  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}
          type=sha,prefix={{branch}}-

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
        platforms: linux/amd64,linux/arm64

  # Deploy Documentation
  docs:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Build documentation
      run: bun run docs:build

    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      if: github.ref == 'refs/heads/main'
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./docs-dist

  # Deploy to Staging
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    environment: staging

    steps:
    - uses: actions/checkout@v4

    - name: Deploy to Kubernetes (Staging)
      env:
        KUBE_CONFIG: ${{ secrets.STAGING_KUBE_CONFIG }}
      run: |
        echo "$KUBE_CONFIG" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
        kubectl set image deployment/ralph-orchestrator \
          ralph=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:develop \
          -n ralph-staging
        kubectl rollout status deployment/ralph-orchestrator -n ralph-staging

  # Deploy to Production
  deploy-production:
    needs: build
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production

    steps:
    - uses: actions/checkout@v4

    - name: Deploy to Kubernetes (Production)
      env:
        KUBE_CONFIG: ${{ secrets.PROD_KUBE_CONFIG }}
      run: |
        echo "$KUBE_CONFIG" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
        VERSION=${GITHUB_REF#refs/tags/}
        kubectl set image deployment/ralph-orchestrator \
          ralph=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:$VERSION \
          -n ralph-production
        kubectl rollout status deployment/ralph-orchestrator -n ralph-production

    - name: Create Release
      uses: softprops/action-gh-release@v1
      with:
        generate_release_notes: true
        files: |
          dist/*
```

### Documentation Workflow

Create `.github/workflows/docs.yml`:

```yaml
name: Deploy Documentation

on:
  push:
    branches: [ main ]
    paths:
      - 'docs/**'
      - 'mkdocs.yml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0  # Full history for git info

    - name: Configure Git
      run: |
        git config user.name github-actions
        git config user.email github-actions@github.com

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Build and Deploy
      run: bun run docs:deploy
```

### Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Build distribution
      run: bun run build

    - name: Publish to npm
      run: |
        echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > .npmrc
        bun publish --access public
      env:
        NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

    - name: Create GitHub Release
      uses: softprops/action-gh-release@v1
      with:
        files: dist/*
        generate_release_notes: true
        body: |
          ## Docker Image
          \`\`\`bash
          docker pull ghcr.io/${{ github.repository }}:${{ github.ref_name }}
          \`\`\`

          ## Changelog
          See [CHANGELOG.md](CHANGELOG.md) for details.
```

## GitLab CI/CD

Create `.gitlab-ci.yml`:

```yaml
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: ""
  IMAGE_TAG: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA

# Test Stage
test:unit:
  stage: test
  image: oven/bun:latest
  script:
    - bun install --frozen-lockfile
    - bun test --coverage
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

test:lint:
  stage: test
  image: oven/bun:latest
  script:
    - bun install --frozen-lockfile
    - bun run lint
    - bun run typecheck

# Build Stage
build:docker:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $IMAGE_TAG .
    - docker push $IMAGE_TAG
    - |
      if [ "$CI_COMMIT_BRANCH" == "main" ]; then
        docker tag $IMAGE_TAG $CI_REGISTRY_IMAGE:latest
        docker push $CI_REGISTRY_IMAGE:latest
      fi

# Deploy Stage
deploy:staging:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: staging
    url: https://staging.ralph.example.com
  only:
    - develop
  script:
    - kubectl set image deployment/ralph ralph=$IMAGE_TAG -n staging
    - kubectl rollout status deployment/ralph -n staging

deploy:production:
  stage: deploy
  image: bitnami/kubectl:latest
  environment:
    name: production
    url: https://ralph.example.com
  only:
    - tags
  when: manual
  script:
    - kubectl set image deployment/ralph ralph=$CI_REGISTRY_IMAGE:$CI_COMMIT_TAG -n production
    - kubectl rollout status deployment/ralph -n production
```

## Jenkins Pipeline

Create `Jenkinsfile`:

```groovy
pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = 'docker.io'
        DOCKER_IMAGE = 'acazau/ralph-orchestrator-ts'
        DOCKER_CREDENTIALS = 'docker-hub-credentials'
        KUBECONFIG_STAGING = credentials('kubeconfig-staging')
        KUBECONFIG_PROD = credentials('kubeconfig-production')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install') {
            steps {
                sh 'curl -fsSL https://bun.sh/install | bash'
                sh 'export BUN_INSTALL="$HOME/.bun" && export PATH="$BUN_INSTALL/bin:$PATH" && bun install --frozen-lockfile'
            }
        }

        stage('Test') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh '''
                            export BUN_INSTALL="$HOME/.bun"
                            export PATH="$BUN_INSTALL/bin:$PATH"
                            bun test --reporter=junit > test-results.xml
                        '''
                        junit 'test-results.xml'
                    }
                }

                stage('Lint') {
                    steps {
                        sh '''
                            export BUN_INSTALL="$HOME/.bun"
                            export PATH="$BUN_INSTALL/bin:$PATH"
                            bun run lint
                        '''
                    }
                }

                stage('Type Check') {
                    steps {
                        sh '''
                            export BUN_INSTALL="$HOME/.bun"
                            export PATH="$BUN_INSTALL/bin:$PATH"
                            bun run typecheck
                        '''
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    docker.withRegistry("https://${DOCKER_REGISTRY}", DOCKER_CREDENTIALS) {
                        def image = docker.build("${DOCKER_IMAGE}:${env.BUILD_NUMBER}")
                        image.push()
                        if (env.BRANCH_NAME == 'main') {
                            image.push('latest')
                        }
                    }
                }
            }
        }

        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                sh '''
                    export KUBECONFIG=${KUBECONFIG_STAGING}
                    kubectl set image deployment/ralph ralph=${DOCKER_IMAGE}:${BUILD_NUMBER} -n staging
                    kubectl rollout status deployment/ralph -n staging
                '''
            }
        }

        stage('Deploy to Production') {
            when {
                tag pattern: "v\\d+\\.\\d+\\.\\d+", comparator: "REGEXP"
            }
            input {
                message "Deploy to production?"
                ok "Deploy"
            }
            steps {
                sh '''
                    export KUBECONFIG=${KUBECONFIG_PROD}
                    kubectl set image deployment/ralph ralph=${DOCKER_IMAGE}:${TAG_NAME} -n production
                    kubectl rollout status deployment/ralph -n production
                '''
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            slackSend(
                color: 'good',
                message: "Build Successful: ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
            )
        }
        failure {
            slackSend(
                color: 'danger',
                message: "Build Failed: ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
            )
        }
    }
}
```

## CircleCI Configuration

Create `.circleci/config.yml`:

```yaml
version: 2.1

orbs:
  docker: circleci/docker@2.2.0
  kubernetes: circleci/kubernetes@1.3.1

executors:
  bun:
    docker:
      - image: oven/bun:latest

jobs:
  test:
    executor: bun
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: bun install --frozen-lockfile
      - run:
          name: Run tests
          command: bun test --coverage
      - store_test_results:
          path: test-results
      - store_artifacts:
          path: coverage

  lint:
    executor: bun
    steps:
      - checkout
      - run:
          name: Install dependencies
          command: bun install --frozen-lockfile
      - run:
          name: Run linting
          command: bun run lint
      - run:
          name: Type check
          command: bun run typecheck

  build-and-push:
    executor: docker/docker
    steps:
      - setup_remote_docker
      - checkout
      - docker/check
      - docker/build:
          image: acazau/ralph-orchestrator-ts
          tag: ${CIRCLE_SHA1}
      - docker/push:
          image: acazau/ralph-orchestrator-ts
          tag: ${CIRCLE_SHA1}

  deploy:
    docker:
      - image: cimg/base:stable
    steps:
      - kubernetes/install-kubectl
      - run:
          name: Deploy to Kubernetes
          command: |
            echo $KUBE_CONFIG | base64 -d > kubeconfig
            export KUBECONFIG=kubeconfig
            kubectl set image deployment/ralph ralph=acazau/ralph-orchestrator-ts:${CIRCLE_SHA1}
            kubectl rollout status deployment/ralph

workflows:
  main:
    jobs:
      - test
      - lint
      - build-and-push:
          requires:
            - test
            - lint
          filters:
            branches:
              only: main
      - deploy:
          requires:
            - build-and-push
          filters:
            branches:
              only: main
```

## Azure DevOps Pipeline

Create `azure-pipelines.yml`:

```yaml
trigger:
  branches:
    include:
    - main
    - develop
  tags:
    include:
    - v*

pool:
  vmImage: 'ubuntu-latest'

variables:
  dockerRegistry: 'your-registry.azurecr.io'
  dockerImageName: 'ralph-orchestrator-ts'
  kubernetesServiceConnection: 'k8s-connection'

stages:
- stage: Test
  jobs:
  - job: TestJob
    steps:
    - task: Bash@3
      inputs:
        targetType: 'inline'
        script: |
          curl -fsSL https://bun.sh/install | bash
          export BUN_INSTALL="$HOME/.bun"
          export PATH="$BUN_INSTALL/bin:$PATH"
          bun install --frozen-lockfile
          bun test
      displayName: 'Install Bun and run tests'

    - task: PublishTestResults@2
      inputs:
        testResultsFiles: 'test-results/*.xml'
        testRunTitle: 'Bun Tests'

- stage: Build
  dependsOn: Test
  jobs:
  - job: BuildJob
    steps:
    - task: Docker@2
      inputs:
        containerRegistry: $(dockerRegistry)
        repository: $(dockerImageName)
        command: buildAndPush
        Dockerfile: Dockerfile
        tags: |
          $(Build.BuildId)
          latest

- stage: Deploy
  dependsOn: Build
  condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
  jobs:
  - deployment: DeployJob
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: Kubernetes@1
            inputs:
              connectionType: 'Kubernetes Service Connection'
              kubernetesServiceEndpoint: $(kubernetesServiceConnection)
              command: 'set'
              arguments: 'image deployment/ralph ralph=$(dockerRegistry)/$(dockerImageName):$(Build.BuildId)'
              namespace: 'production'
```

## ArgoCD GitOps

Create `argocd/application.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ralph-orchestrator-ts
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/acazau/ralph-orchestrator-ts
    targetRevision: HEAD
    path: k8s
    helm:
      valueFiles:
        - values.yaml
      parameters:
        - name: image.tag
          value: latest
  destination:
    server: https://kubernetes.default.svc
    namespace: ralph-production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
      allowEmpty: false
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

## Tekton Pipeline

Create `tekton/pipeline.yaml`:

```yaml
apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: ralph-ci-pipeline
spec:
  params:
    - name: repo-url
      type: string
    - name: revision
      type: string
      default: main
  workspaces:
    - name: shared-workspace
  tasks:
    - name: fetch-source
      taskRef:
        name: git-clone
      workspaces:
        - name: output
          workspace: shared-workspace
      params:
        - name: url
          value: $(params.repo-url)
        - name: revision
          value: $(params.revision)

    - name: run-tests
      runAfter:
        - fetch-source
      taskSpec:
        workspaces:
          - name: source
        steps:
          - name: test
            image: oven/bun:latest
            script: |
              cd $(workspaces.source.path)
              bun install --frozen-lockfile
              bun test
      workspaces:
        - name: source
          workspace: shared-workspace

    - name: build-image
      runAfter:
        - run-tests
      taskRef:
        name: buildah
      workspaces:
        - name: source
          workspace: shared-workspace
      params:
        - name: IMAGE
          value: ghcr.io/acazau/ralph-orchestrator-ts

    - name: deploy
      runAfter:
        - build-image
      taskRef:
        name: kubernetes-actions
      params:
        - name: script
          value: |
            kubectl set image deployment/ralph ralph=ghcr.io/acazau/ralph-orchestrator-ts:$(params.revision)
            kubectl rollout status deployment/ralph
```

## Monitoring and Notifications

### Slack Notifications

Add to any CI/CD platform:

```yaml
# GitHub Actions example
- name: Slack Notification
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment ${{ job.status }}'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
  if: always()
```

### Health Checks

```yaml
# Post-deployment validation
- name: Health Check
  run: |
    for i in {1..30}; do
      if curl -f http://ralph.example.com/health; then
        echo "Service is healthy"
        exit 0
      fi
      sleep 10
    done
    echo "Health check failed"
    exit 1
```

## Best Practices

1. **Version Everything**: Tag releases with semantic versioning
2. **Automate Tests**: Run tests on every commit
3. **Security Scanning**: Include SAST and dependency scanning
4. **Progressive Deployment**: Use staging environments
5. **Rollback Strategy**: Implement automatic rollback on failures
6. **Secrets Management**: Never commit secrets, use CI/CD secrets
7. **Artifact Storage**: Store build artifacts for reproducibility
8. **Monitoring**: Track deployment metrics and success rates
9. **Documentation**: Update docs with every release
10. **Compliance**: Audit trail for all deployments

## Next Steps

- [Production Deployment](production.md) - Production best practices
- [Monitoring Setup](../advanced/monitoring.md) - Observability configuration
- [Security Guide](../advanced/security.md) - Security hardening
