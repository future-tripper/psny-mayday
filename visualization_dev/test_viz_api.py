#!/usr/bin/env python3
"""
Test the visualization API endpoints with test data
Run this to verify the API is working before building the frontend
"""

import os
import json
import sys
from urllib.parse import urljoin
import requests

def test_api_endpoints():
    """Test the visualization API endpoints"""

    # Set environment variable to use test database
    os.environ["MAYDAY_VIZ_TEST"] = "true"

    base_url = "http://localhost:8000"
    crown_id = 1  # Test Crown ID

    print("🧪 Testing Visualization API with test database")
    print("=" * 50)

    try:
        # Test nodes endpoint
        nodes_url = f"{base_url}/api/crown/{crown_id}/nodes"
        print(f"Testing: {nodes_url}")

        response = requests.get(nodes_url)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Nodes API: {data['total_nodes']} nodes returned")
            print(f"   Crown status: {data['status']}")
            print(f"   Source: {data['source_title']}")

            # Show first few nodes
            print("\n📝 First 3 nodes:")
            for i, node in enumerate(data['nodes'][:3]):
                print(f"   {i+1}. {node['authors']} (Position {node['position']})")
                print(f"      First line: {node['first_line'][:50]}...")

            # Show connections
            print(f"\n🔗 Connections: {len(data['connections'])}")
            for i, conn in enumerate(data['connections'][:3]):
                print(f"   {i+1}. Sonnet {conn['from']} → Sonnet {conn['to']}")
        else:
            print(f"❌ Nodes API failed: {response.status_code}")
            print(response.text)

        print()

        # Test stats endpoint
        stats_url = f"{base_url}/api/crown/{crown_id}/stats"
        print(f"Testing: {stats_url}")

        response = requests.get(stats_url)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Stats API: {data['completed_pairs']}/{data['total_pairs']} pairs complete")
            print(f"   Completion: {data['completion_percentage']:.1f}%")
            print(f"   Is complete: {data['is_complete']}")
        else:
            print(f"❌ Stats API failed: {response.status_code}")
            print(response.text)

    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Is the app running?")
        print("   Start with: uvicorn app:app --reload")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

    print("\n✨ API tests complete!")
    print("\nNext steps:")
    print("1. Leave MAYDAY_VIZ_TEST=true while developing visualization")
    print("2. Build D3.js frontend that calls these endpoints")
    print("3. When ready, set MAYDAY_VIZ_TEST=false to use production data")

    return True

if __name__ == "__main__":
    test_api_endpoints()