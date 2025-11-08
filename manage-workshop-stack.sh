#!/bin/bash

STACK_OPERATION=$1

if [[ "$STACK_OPERATION" == "Create" || "$STACK_OPERATION" == "Update" ]]; then
    echo "🎓 Creating Grafana MCP Workshop Environment..."
     
    # Install and configure Podman (Docker-compatible)
    sudo yum install -y podman
    sudo systemctl start podman
    sudo systemctl enable podman
    
    # Create Docker alias for CDK compatibility
    sudo ln -sf /usr/bin/podman /usr/local/bin/docker
    
    # Bootstrap CDK
    cdk bootstrap --require-approval never
    
    # Run complete setup
    ./scripts/complete-setup.sh
   
elif [ "$STACK_OPERATION" == "Delete" ]; then
    echo "🧹 Cleaning up workshop..."
    cd /home/ec2-user/environment
    cdk destroy --all --force || true
   
else
    echo "Invalid stack operation!"
    exit 1
fi
